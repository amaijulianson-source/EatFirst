import { type Data, type Food } from "../core";
import {
  normalizeProduct,
  productKey,
  productMentions,
  type Pattern,
} from "../entry/model";
import { numberWords, spokenDate } from "./dates";
export type VoiceMode = "check" | "purchase";
export type VoiceItem = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string;
  category: Food["category"];
  location: Food["location"];
  expiry: string;
  dateType: Food["dateType"] | "unknown";
  lowStock: boolean | null;
  locationSpoken: boolean;
  expirySpoken: boolean;
  warnings: string[];
};
export type Interpretation = {
  items: VoiceItem[];
  unresolved: string[];
  suggestedMode?: VoiceMode;
};
const unitWords =
  "pieces?|stuks?|cartons?|pakken?|pak|packs?|bottles?|flessen?|fles|loaves|loaf|broden?|brood|bags?|zakken?|zak|cans?|blikken?|blik|containers?|bakjes?|tubs?|jars?|potten?|pot|boxes|box|dozen|doos|bunch(?:es)?|bossen|bos|litres?|liters?|liter|litre|ml|milliliters?|g|grams?|gram|kg|kilograms?|kilo";
export function spokenUnit(word: string, food = "") {
  if (/^(?:carton|pak|pack)/.test(word))
    return /milk|drink|melk/i.test(food)
      ? "carton"
      : /carton/.test(word)
        ? "carton"
        : "pack";
  if (/^(?:bottle|fles)/.test(word)) return "bottle";
  if (/^(?:loaf|loaves|brood|broden)/.test(word)) return "loaf";
  if (/^(?:bag|zak)/.test(word)) return "bag";
  if (/^(?:can|blik)/.test(word)) return "can";
  if (/^(?:container|bakje|tub)/.test(word)) return "container";
  if (/^(?:jar|pot)/.test(word)) return "jar";
  if (/^(?:box|doos|dozen)/.test(word)) return "box";
  if (/^(?:bunch|bos)/.test(word)) return "bunch";
  if (/^(?:lit|liter)/.test(word)) return "litre";
  if (/^(?:ml|millil)/.test(word)) return "ml";
  if (/^(?:kg|kilo)/.test(word)) return "kg";
  if (/^(?:g|gram)/.test(word)) return "g";
  return "pieces";
}
const quantityEnd = new RegExp(
  `(?:^|\\b)(half(?:\\s+a)?|halve?|(?:another(?:\\s+(?:1|a))?|nog\\s+1)|\\d+(?:[.,]\\d+)?|a|an)\\s*(?:(${unitWords})\\s*)?(?:(?:of|van|aan)\\s*)?(?:like\\s*)?$`,
  "i",
);
function quantity(text: string, name = "") {
  const s = text.trim();
  const m = s.match(quantityEnd);
  if (!m) return null;
  const value = /half|halve/.test(m[1])
    ? 0.5
    : /another|nog|^a$|^an$/.test(m[1])
      ? 1
      : Number(m[1].replace(",", "."));
  if (!Number.isFinite(value)) return null;
  return {
    value,
    unit: m[2] ? spokenUnit(m[2].toLowerCase(), name) : undefined,
    index: m.index!,
  };
}
const correction =
  /\b(?:actually|oh wait|no[, ]|no i meant|i meant|make (?:that|it)|correct(?:ion)?|instead|nee|eigenlijk|ik bedoel|maak (?:dat|er)|toch)\b/i;
const addition = /\b(?:another|additional|extra|more|nog|erbij)\b/i;
const filler =
  /^(?:(?:uh+m*|um+m*|eh+m*|okay|ok|so|well|let me see|i think|even kijken|eens kijken|ik denk|ja|nou)\s*)+$/i;
function qualifiers(row: VoiceItem, text: string, today: string) {
  const date = spokenDate(text, today);
  if (date) {
    if (date.date) {
      row.expiry = date.date;
      row.expirySpoken = true;
      row.dateType = date.type ?? "unknown";
    }
    row.warnings.push(date.reason);
  }
  if (
    /\b(?:almost (?:finished|empty)|nearly (?:empty|gone|finished)|barely any|only a little|not much left|running low|need more|bijna (?:op|leeg)|bijna geen|weinig (?:meer|over)|niet veel (?:meer|over)|meer nodig|beetje over)\b/.test(
      text,
    )
  )
    row.lowStock = true;
  if (
    /\b(?:not (?:low|nearly empty)|full again|no longer low|niet bijna op|weer vol)\b/.test(
      text,
    )
  )
    row.lowStock = false;
  const storage = text.match(
    /\b(fridge|refrigerator|freezer|pantry|cupboard|koelkast|vriezer|diepvries|voorraadkast|keukenkast)\b/,
  );
  if (storage) {
    row.location = /freezer|vriezer|diepvries/.test(storage[1])
      ? "Freezer"
      : /fridge|refrigerator|koelkast/.test(storage[1])
        ? "Fridge"
        : "Pantry";
    row.locationSpoken = true;
  }
  if (
    /\b(?:a few|some|several|een paar|een beetje|wat|enkele)\b/.test(text) &&
    row.quantity === null
  )
    row.warnings.push(
      "Amount is approximate or unspecified. Leave it unknown or enter a count.",
    );
}
/** Deterministic local interpretation of common English/Dutch grocery conversations.
 * Entity spans, quantities, qualifiers and contextual corrections are separate.
 * This is a bounded grammar, not a general-purpose language model.
 */
export function interpretInventory(
  transcript: string,
  options: {
    today: string;
    mode: VoiceMode;
    existing?: Data["foods"];
    patterns?: Pattern[];
  },
): Interpretation {
  const items: VoiceItem[] = [],
    unresolved: string[] = [];
  const names = [
    ...(options.existing ?? []).map((f) => f.name),
    ...(options.patterns ?? []).map((p) => p.name),
  ];
  let focus: VoiceItem | undefined;
  let referenceGroup: VoiceItem[] = [];
  let correctionPending = false;
  const normalized = numberWords(transcript)
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/\b(?:u+h+m*|u+m+m*|e+h+m*)\b/gi, " ")
    .replace(/\blike\b/g, " ");
  // Clause markers help context; multiple food entities within a clause do not need punctuation.
  const clauses = normalized
    .replace(
      /\b(oh wait|actually|no i meant|i meant|make that|make it|ik bedoel|eigenlijk|nee|maak dat)\b/g,
      "\n$1 ",
    )
    .split(/\n|[;…!?]|\.(?!\d)|,|\b(?:and|en)\b/)
    .map((s) => s.trim())
    .filter(Boolean);
  function newRow(name: string): VoiceItem {
    const n = normalizeProduct(name),
      memory = options.patterns?.find(
        (p) => productKey(p.name) === productKey(n.name),
      );
    return {
      id: `voice-${items.length + 1}`,
      name: n.name,
      quantity: null,
      unit: "pieces",
      category: memory?.category ?? n.category,
      location: memory?.location ?? n.location,
      expiry: "",
      dateType: "unknown",
      lowStock: null,
      locationSpoken: false,
      expirySpoken: false,
      warnings: n.known ? [] : ["Check this product name and storage."],
    };
  }
  for (const clause of clauses) {
    if (filler.test(clause)) continue;
    if (
      /^(?:no|nee|oh wait|actually|i meant|ik bedoel|make that|make it|eigenlijk)$/.test(
        clause,
      )
    ) {
      correctionPending = true;
      continue;
    }
    const mentions = productMentions(clause, names);
    const thisGroup: VoiceItem[] = [];
    if (mentions.length) {
      for (let i = 0; i < mentions.length; i++) {
        const m = mentions[i];
        let before = clause.slice(i ? mentions[i - 1].end : 0, m.start),
          after = clause.slice(
            m.end,
            i + 1 < mentions.length ? mentions[i + 1].start : undefined,
          );
        if (i + 1 < mentions.length) {
          const nextQuantity = quantity(after, mentions[i + 1].name);
          if (nextQuantity) after = after.slice(0, nextQuantity.index);
        }
        // An expiry number belongs to the previous food, never to the next one.
        if (spokenDate(before, options.today)) before = "";
        const q = quantity(before, m.name);
        const postfix = after.match(new RegExp(`^\\s*(${unitWords})\\b`, "i"));
        if (q && !q.unit && postfix) q.unit = spokenUnit(postfix[1], m.name);
        const key = productKey(m.name);
        let row = items.find((r) => productKey(r.name) === key);
        const previouslyMentioned = Boolean(row);
        const isCorrection = correction.test(before) || correctionPending,
          isAddition = addition.test(before) && !/\bneed more\b/.test(before);
        if (
          !row &&
          isCorrection &&
          focus &&
          (/\b(?:i meant|make (?:that|it)|ik bedoel|maak (?:dat|er)|instead)\b/.test(
            before,
          ) ||
            m.raw.includes(focus.name.toLowerCase())) &&
          !/\b(?:the|de|het)\b/.test(before.replace(/make (?:that|it)/g, ""))
        ) {
          // "Milk ... actually make that oat milk" renames the current draft.
          const n = normalizeProduct(m.name);
          focus.name = n.name;
          focus.category = n.category;
          if (!focus.locationSpoken) focus.location = n.location;
          row = focus;
        }
        if (!row) {
          row = newRow(m.name);
          items.push(row);
        }
        if (q) {
          const qUnit = q.unit ?? row.unit;
          if (isAddition && previouslyMentioned && row.quantity === null) {
            row.warnings.push(
              "An extra amount was mentioned, but the original count is unknown. Confirm the total.",
            );
          } else if (isAddition && row.quantity !== null) {
            if (row.unit === qUnit) row.quantity += q.value;
            else
              row.warnings.push(
                "Additional amount uses a different unit. Confirm the total manually.",
              );
          } else {
            if (
              row.quantity !== null &&
              row.quantity !== q.value &&
              !isCorrection &&
              !isAddition
            )
              row.warnings.push(
                "Repeated quantity treated as a total, not added. Confirm the intended count.",
              );
            row.quantity = q.value;
            row.unit = qUnit;
          }
        }
        if (/\b(?:none|no|geen|0)\s*$/.test(before) && !isCorrection) {
          row.quantity = null;
          row.warnings.push(
            "You may be describing an empty item. Remove this row or choose the intended action; nothing is deleted automatically.",
          );
        }
        qualifiers(row, `${before} ${after}`, options.today);
        const tail = after.match(
          /\b(?:actually|make (?:that|it)|no|nee|toch|maak (?:dat|er))\s*(?:there are|er zijn|het zijn)?\s*(\d+(?:[.,]\d+)?)\b/,
        );
        if (tail) row.quantity = Number(tail[1].replace(",", "."));
        const statedTotal = after.match(
          /^\s*(?:are|is|zijn|is er)\s+(\d+(?:[.,]\d+)?)\b/,
        );
        if (statedTotal)
          row.quantity = Number(statedTotal[1].replace(",", "."));
        correctionPending = false;
        focus = row;
        thisGroup.push(row);
      }
      referenceGroup = thisGroup;
    } else if (focus) {
      const isCorrection = correction.test(clause) || correctionPending;
      const q = quantity(
        clause.replace(/\b(?:in total|total|totaal|over|left)\b/g, "").trim(),
        focus.name,
      );
      if (q?.unit && addition.test(clause) && q.unit !== focus.unit) {
        const candidates = items.filter((item) => item.unit === q.unit);
        if (candidates.length === 1) focus = candidates[0];
        else {
          unresolved.push(
            `Which product has the additional ${q.unit}? “${clause}”`,
          );
          continue;
        }
      }
      const isQualifier =
        Boolean(spokenDate(clause, options.today)) ||
        /\b(?:almost|nearly|barely|left|low|need more|bijna|weinig|nodig|fridge|freezer|pantry|koelkast|vriezer|voorraadkast)\b/.test(
          clause,
        );
      const ambiguous =
        (referenceGroup.length > 1 ||
          (/\b(?:both|them|those|beide|allebei)\b/.test(clause) &&
            items.length > 1 &&
            !(focus.quantity !== null && focus.quantity > 1))) &&
        /\b(?:it|that|this|those|dat|die|deze|het)\b/.test(clause);
      if (ambiguous && (isQualifier || q)) {
        unresolved.push(`Which item did you mean? “${clause}”`);
        continue;
      }
      if (q && !spokenDate(clause, options.today)) {
        if (isCorrection) {
          focus.quantity = q.value;
          correctionPending = false;
          if (q.unit) focus.unit = q.unit;
        } else if (addition.test(clause)) {
          if (q.unit && q.unit !== focus.unit)
            focus.warnings.push(
              "Additional amount has a different unit. Confirm the total manually.",
            );
          else if (focus.quantity !== null) focus.quantity += q.value;
          else
            focus.warnings.push(
              "An extra item was mentioned, but the original count is unknown.",
            );
        } else if (!isQualifier)
          unresolved.push(`Check this amount: “${clause}”`);
      }
      if (isQualifier) qualifiers(focus, clause, options.today);
      else if (
        !q &&
        !filler.test(clause) &&
        !/^(?:there's also|there is also|er is ook|oh wait|okay|so|let me see|i think|uhh*|umm*)$/.test(
          clause,
        )
      )
        unresolved.push(`Not understood: “${clause}”`);
    } else if (!filler.test(clause))
      unresolved.push(`Not understood: “${clause}”`);
  }
  for (const row of items) {
    row.warnings = [...new Set(row.warnings)];
    if (
      row.quantity !== null &&
      (!Number.isFinite(row.quantity) ||
        row.quantity <= 0 ||
        row.quantity > 1000000)
    ) {
      row.quantity = null;
      row.warnings.push("Check the spoken quantity.");
    }
  }
  return {
    items,
    unresolved: [...new Set(unresolved)],
    suggestedMode: /\b(?:bought|purchased|gekocht)\b/.test(normalized)
      ? "purchase"
      : /\b(?:i have|we have|there is|there's|ik heb|we hebben|er is)\b/.test(
            normalized,
          )
        ? "check"
        : undefined,
  };
}
