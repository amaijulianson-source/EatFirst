import {
  type Data,
  type Food,
  type Shopping,
  localDate,
  validDate,
  validateBackup,
} from "../core";
import { ingredientKey, profiles, aliases } from "../cooking/ingredients";
export type Pattern = {
  name: string;
  quantity: number;
  unit: string;
  location: Food["location"];
  category: Food["category"];
  barcode?: string;
  count: number;
  lastUsed: string;
};
export type Draft = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: Food["category"];
  location: Food["location"];
  expiry: string;
  dateType: Food["dateType"];
  notes: string;
  source: "manual" | "shopping";
  sources: string[];
  review: string[];
  shoppingId?: string;
  included: boolean;
  quantityEvidence?: "label" | "pattern" | "unverified" | "confirmed";
};
const rules: [RegExp, string, Food["category"], Food["location"]][] = [
  [
    /\b(?:sweet potato(?:es)?|zoete aardappelen?|zoete aardappel)\b/i,
    "Sweet potato",
    "Produce",
    "Pantry",
  ],
  [
    /\b(?:canned tomato(?:es)?|tinned tomato(?:es)?|tomatenblokjes)\b/i,
    "Canned tomato",
    "Pantry",
    "Pantry",
  ],
  [/\b(?:green beans?|sperziebonen)\b/i, "Green bean", "Produce", "Fridge"],

  [/\b(?:peanut butter|pindakaas)\b/i, "Peanut butter", "Pantry", "Pantry"],
  [/\b(?:almond butter|cashew butter)\b/i, "Nut butter", "Pantry", "Pantry"],
  [
    /\b(?:soy yogurt|soy yoghurt|sojayoghurt)\b/i,
    "Soy yogurt",
    "Other",
    "Fridge",
  ],
  [
    /\b(?:oat yogurt|oat yoghurt|haveryoghurt)\b/i,
    "Oat yogurt",
    "Other",
    "Fridge",
  ],
  [
    /\b(?:vegan cheese|plant.based cheese)\b/i,
    "Vegan cheese",
    "Other",
    "Fridge",
  ],
  [/\b(?:coconut milk|kokosmelk)\b/i, "Coconut milk", "Pantry", "Pantry"],
  [
    /\b(?:milk chocolate|melkchocolade)\b/i,
    "Milk chocolate",
    "Pantry",
    "Pantry",
  ],
  [
    /\b(?:chicken stock|chicken broth|kippenbouillon)\b/i,
    "Chicken stock",
    "Pantry",
    "Pantry",
  ],
  [
    /\b(?:vegetable stock|groentebouillon)\b/i,
    "Vegetable stock",
    "Pantry",
    "Pantry",
  ],
  [
    /\b(?:chicken nuggets|kipnuggets)\b/i,
    "Chicken nuggets",
    "Frozen food",
    "Freezer",
  ],
  [
    /\b(?:cooked chicken|gegaarde kip)\b/i,
    "Cooked chicken",
    "Cooked leftovers",
    "Fridge",
  ],
  [
    /\b(?:pet food|dog food|cat food|hondenvoer|kattenvoer)\b/i,
    "Pet food",
    "Other",
    "Pantry",
  ],
  [
    /\b(?:halfvolle melk|semi[- ]skimmed milk)\b/i,
    "Milk (semi-skimmed)",
    "Dairy",
    "Fridge",
  ],
  [/\b(?:volle melk|whole milk)\b/i, "Milk (whole)", "Dairy", "Fridge"],
  [/\b(?:magere melk|skimmed milk)\b/i, "Milk (skimmed)", "Dairy", "Fridge"],
  [/\b(?:havermelk|oat milk|oat drink)\b/i, "Oat drink", "Drinks", "Fridge"],
  [/\b(?:sojamelk|soy milk|soy drink)\b/i, "Soy drink", "Drinks", "Fridge"],
  [/\b(?:amandelmelk|almond milk)\b/i, "Almond drink", "Drinks", "Fridge"],
  [/\b(?:melk|milk)\b/i, "Milk", "Dairy", "Fridge"],
  [/\b(?:eieren|eggs?|ei)\b/i, "Eggs", "Dairy", "Fridge"],
  [
    /\b(?:spaghetti|penne|fusilli|macaroni|pasta)\b/i,
    "Pasta",
    "Pantry",
    "Pantry",
  ],
  [
    /\b(?:kipfilet|chicken breast)\b/i,
    "Chicken breast",
    "Meat & fish",
    "Fridge",
  ],
  [/\b(?:kip|chicken)\b/i, "Chicken", "Meat & fish", "Fridge"],
  [/\b(?:yogh?urt|kwark)\b/i, "Yogurt", "Dairy", "Fridge"],
  [/\b(?:kaas|cheese|cheddar)\b/i, "Cheese", "Dairy", "Fridge"],
  [/\b(?:boter|butter)\b/i, "Butter", "Dairy", "Fridge"],
  [/\b(?:zalm|salmon)\b/i, "Salmon", "Meat & fish", "Fridge"],
  [/\b(?:kabeljauw|cod)\b/i, "Cod", "Meat & fish", "Fridge"],
  [/\b(?:brood|bread)\b/i, "Bread", "Bread & bakery", "Pantry"],
  [
    /\b(?:aardappelen|aardappel|potatoes|potato)\b/i,
    "Potatoes",
    "Produce",
    "Pantry",
  ],
  [/\b(?:tomaten|tomaat|tomatoes|tomato)\b/i, "Tomatoes", "Produce", "Fridge"],
  [/\b(?:wortelen|wortels?|carrots?)\b/i, "Carrots", "Produce", "Fridge"],
  [/\b(?:spinazie|spinach)\b/i, "Spinach", "Produce", "Fridge"],
  [/\b(?:champignons?|mushrooms?)\b/i, "Mushrooms", "Produce", "Fridge"],
  [/\b(?:broccoli)\b/i, "Broccoli", "Produce", "Fridge"],
  [/\b(?:paprika|bell peppers?)\b/i, "Bell pepper", "Produce", "Fridge"],
  [/\b(?:komkommer|cucumber)\b/i, "Cucumber", "Produce", "Fridge"],
  [/\b(?:courgette|zucchini)\b/i, "Zucchini", "Produce", "Fridge"],
  [/\b(?:rijst|rice)\b/i, "Rice", "Pantry", "Pantry"],
  [/\b(?:havermout|oats)\b/i, "Oats", "Pantry", "Pantry"],
  [/\b(?:bananen?|bananas?)\b/i, "Bananas", "Produce", "Pantry"],
  [/\b(?:appels?|apples?)\b/i, "Apples", "Produce", "Fridge"],
  [/\b(?:tofu)\b/i, "Tofu", "Pantry", "Fridge"],
  [/\b(?:sojasaus|soy sauce)\b/i, "Soy sauce", "Pantry", "Pantry"],
  [/\b(?:olijfolie|olive oil)\b/i, "Olive oil", "Pantry", "Pantry"],
  [/\b(?:uien|ui|onions?)\b/i, "Onions", "Produce", "Pantry"],
  [/\b(?:knoflook|garlic)\b/i, "Garlic", "Produce", "Pantry"],
  [/\b(?:citroen|lemons?)\b/i, "Lemon", "Produce", "Fridge"],
  [/\b(?:sinaasappels?|oranges?)\b/i, "Oranges", "Produce", "Fridge"],
  [/\b(?:kikkererwten|chickpeas?)\b/i, "Chickpeas", "Pantry", "Pantry"],
  [/\b(?:linzen|lentils?)\b/i, "Lentils", "Pantry", "Pantry"],
  [/\b(?:bloem|flour)\b/i, "Flour", "Pantry", "Pantry"],
  [/\b(?:sugar|suiker)\b/i, "Sugar", "Pantry", "Pantry"],
  [/\b(?:ketchup|tomatenketchup)\b/i, "Ketchup", "Pantry", "Pantry"],
  [/\b(?:water|water bottles?)\b/i, "Water", "Drinks", "Pantry"],
  [
    /\b(?:aardbeien|strawberr(?:y|ies))\b/i,
    "Strawberries",
    "Produce",
    "Fridge",
  ],
  [/\b(?:peren|peer|pears?)\b/i, "Pears", "Produce", "Fridge"],
  [/\b(?:ham|ham slices?)\b/i, "Ham", "Meat & fish", "Fridge"],
  [/\b(?:jam|marmelade)\b/i, "Jam", "Pantry", "Pantry"],
  [/\b(?:bonen|beans?)\b/i, "Beans", "Pantry", "Pantry"],
  [/\b(?:mayonaise|mayonnaise)\b/i, "Mayonnaise", "Pantry", "Pantry"],
  [/\b(?:koffie|coffee)\b/i, "Coffee", "Pantry", "Pantry"],
];
// Longest non-overlapping food spans; quantities and references are interpreted separately.
export function productMentions(text: string, extraNames: string[] = []) {
  const hits: { start: number; end: number; raw: string; name: string }[] = [];
  for (const [expression, name] of rules) {
    for (const match of text.matchAll(new RegExp(expression.source, "gi")))
      hits.push({
        start: match.index!,
        end: match.index! + match[0].length,
        raw: match[0],
        name,
      });
  }
  for (const name of [
    ...extraNames,
    ...Object.keys(profiles),
    ...Object.keys(aliases),
  ]) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!escaped) continue;
    for (const match of text.matchAll(new RegExp(`\\b${escaped}\\b`, "gi")))
      hits.push({
        start: match.index!,
        end: match.index! + match[0].length,
        raw: match[0],
        name: normalizeProduct(name).name,
      });
  }
  const accepted: typeof hits = [];
  for (const hit of hits.sort((a, b) => b.end - b.start - (a.end - a.start))) {
    if (!accepted.some((h) => hit.start < h.end && hit.end > h.start))
      accepted.push(hit);
  }
  return accepted.sort((a, b) => a.start - b.start);
}
export const commonGroceries = [
  "Milk",
  "Eggs",
  "Pasta",
  "Chicken breast",
  "Broccoli",
  "Spinach",
  "Yogurt",
  "Bread",
  "Tomatoes",
  "Rice",
  "Apples",
  "Potatoes",
];
export function productKey(name: string) {
  const n = normalizeProduct(name).name;
  return n.toLocaleLowerCase().trim();
}
export function normalizeProduct(raw: string) {
  const clean = raw
    .normalize("NFKC")
    .replace(/([A-Za-z])(?=\d)/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
  const variant = clean.match(/^milk\s*\((semi-skimmed|whole|skimmed)\)/i);
  const rule = variant
    ? rules.find(
        (r) => r[1].toLowerCase() === `milk (${variant[1].toLowerCase()})`,
      )
    : rules.find(([r]) => r.test(clean));
  const frozen = /\b(?:frozen|diepvries|bevroren)\b/i.test(clean);
  let name =
    rule?.[1] ??
    clean
      .replace(/^\b(?:AH|Jumbo|Lidl|Aldi)\b\s*/i, "")
      .replace(
        /\b\d+(?:[.,]\d+)?\s*(?:kg|g|ml|cl|dl|l|litres?|liters?)\b/gi,
        "",
      )
      .trim();
  if (!name) name = "";
  const known = rule ? true : Boolean(profiles[ingredientKey(name)]);
  if (!rule && known)
    name = profiles[ingredientKey(name)].name.replace(/^./, (c) =>
      c.toUpperCase(),
    );
  const location = frozen ? "Freezer" : (rule?.[3] ?? "Pantry");
  return {
    name,
    category: (rule?.[2] ?? "Other") as Food["category"],
    location: location as Food["location"],
    known,
    detail:
      rule && clean.toLowerCase() !== name.toLowerCase()
        ? clean.slice(0, 200)
        : "",
  };
}
export function parseQuantity(raw: string): {
  quantity: number;
  unit: string;
  explicit: boolean;
  label: string;
} {
  const m = raw
    .toLowerCase()
    .replace(/,/g, ".")
    .match(
      /(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(kilograms?|kg|grams?|gr|g|millilit(?:er|re)s?|ml|cl|dl|lit(?:er|re)s?|l|stuks?|pieces?|pcs|eggs?|eieren|packs?|pakken|loaves|loaf|cans?|blikken|bottles?|flessen|bags?|zakken|bunch(?:es)?|bosjes?|box(?:es)?|dozen|portions?|porties)\b/,
    );
  if (!m)
    return {
      quantity: 1,
      unit: "pieces",
      explicit: false,
      label: "Quantity not detected; confirm package count.",
    };
  const multiplier = Number(m[1] ?? 1),
    q = Number(m[2]) * multiplier;
  let unit = m[3];
  let quantity = q;
  if (/^kg|kilogram/.test(unit)) unit = "kg";
  else if (/^(g|gr|gram)/.test(unit)) unit = "g";
  else if (unit === "cl") {
    quantity *= 10;
    unit = "ml";
  } else if (unit === "dl") {
    quantity *= 100;
    unit = "ml";
  } else if (/^ml|millilit/.test(unit)) unit = "ml";
  else if (/^l|lit/.test(unit)) unit = "litre";
  else if (/pack|pakk/.test(unit)) unit = "pack";
  else if (/loaf|loaves/.test(unit)) unit = "loaf";
  else if (/can|blik/.test(unit)) unit = "can";
  else if (/bottle|fles/.test(unit)) unit = "bottle";
  else if (/bag|zak/.test(unit)) unit = "bag";
  else if (/bunch|bos/.test(unit)) unit = "bunch";
  else if (/box|dozen/.test(unit)) unit = "box";
  else if (/portion|portie/.test(unit)) unit = "portion";
  else unit = "pieces";
  return { quantity, unit, explicit: true, label: m[0] };
}
export function makeDraft(
  raw: string,
  source: Draft["source"] = "manual",
  patterns: Pattern[] = [],
  quantityText?: string,
): Draft {
  const n = normalizeProduct(raw),
    q = parseQuantity(quantityText ?? raw),
    memory = patterns.find((p) => productKey(p.name) === productKey(n.name));
  return {
    id: crypto.randomUUID(),
    name: n.name,
    quantityEvidence: q.explicit ? "label" : memory ? "pattern" : "unverified",
    quantity: q.explicit ? q.quantity : (memory?.quantity ?? 1),
    unit: q.explicit ? q.unit : (memory?.unit ?? "pieces"),
    category: memory?.category ?? n.category,
    location: /\b(?:frozen|diepvries|bevroren)\b/i.test(raw)
      ? "Freezer"
      : (memory?.location ?? n.location),
    expiry: "",
    dateType:
      n.category === "Meat & fish" || n.category === "Dairy"
        ? "use-by"
        : "best-before",
    notes: n.detail ? `Label: ${n.detail}` : "",
    source,
    sources: [raw.slice(0, 200)],
    review: [
      !n.known
        ? "Name not recognized; edit it before saving."
        : "Suggested name and storage; confirm both.",
      q.explicit
        ? `Package size: ${q.label}. Verify total quantity.`
        : memory
          ? "Saved pattern reused; check this purchase."
          : q.label,
    ],
    included: true,
  };
}
export function draftFromShopping(s: Shopping, patterns: Pattern[] = []) {
  const d = makeDraft(s.name, "shopping", patterns, s.quantity);
  return { ...d, shoppingId: s.id, category: s.category ?? d.category };
}
export function sharedPatterns(data: Data): Pattern[] {
  const foods = [
    ...data.foods,
    ...[...data.events].reverse().map((e) => e.food),
  ];
  const result: Pattern[] = [];
  for (const f of foods) {
    if (result.some((p) => productKey(p.name) === productKey(f.name))) continue;
    result.push({
      name: f.name,
      quantity: f.quantity,
      unit: f.unit,
      location: f.location,
      category: f.category,
      count: 1,
      lastUsed: f.added,
    });
  }
  return result.slice(0, 100);
}
export function validatePatterns(value: unknown): Pattern[] {
  if (!Array.isArray(value) || value.length > 200)
    throw Error("Invalid product patterns.");
  for (const p of value) {
    if (
      !p ||
      typeof p.name !== "string" ||
      p.name.length > 100 ||
      !Number.isFinite(p.quantity) ||
      p.quantity <= 0 ||
      p.quantity > 1000000 ||
      typeof p.unit !== "string" ||
      p.unit.length > 30 ||
      !["Fridge", "Freezer", "Pantry"].includes(p.location) ||
      ![
        "Produce",
        "Dairy",
        "Meat & fish",
        "Bread & bakery",
        "Cooked leftovers",
        "Drinks",
        "Frozen food",
        "Pantry",
        "Other",
      ].includes(p.category) ||
      !Number.isInteger(p.count) ||
      p.count < 1 ||
      typeof p.lastUsed !== "string" ||
      !validDate(p.lastUsed) ||
      (p.barcode !== undefined && !/^\d{8,14}$/.test(p.barcode))
    )
      throw Error("Invalid product patterns.");
  }
  return value;
}
export function learnPatterns(
  patterns: Pattern[],
  rows: Draft[],
  today = localDate(),
) {
  let next = structuredClone(patterns);
  for (const r of rows.filter((r) => r.included)) {
    const old = next.find((p) => productKey(p.name) === productKey(r.name));
    next = next.filter((p) => productKey(p.name) !== productKey(r.name));
    next.unshift({
      name: r.name,
      quantity: r.quantity,
      unit: r.unit,
      location: r.location,
      category: r.category,
      barcode: old?.barcode,
      count: (old?.count ?? 0) + 1,
      lastUsed: today,
    });
  }
  return validatePatterns(next.slice(0, 200));
}
export function saveDrafts(
  current: Data,
  rows: Draft[],
  baseline: Data,
  merge = false,
  today = localDate(),
): { data: Data; ids: string[] } {
  const selected = rows.filter((r) => r.included);
  if (!selected.length) throw Error("Select at least one item.");
  const next = structuredClone(current);
  const ids: string[] = [];
  const shoppingIds = selected.flatMap((r) =>
    r.shoppingId ? [r.shoppingId] : [],
  );
  if (new Set(shoppingIds).size !== shoppingIds.length)
    throw Error(
      "The same shopping item is selected twice. Remove the duplicate.",
    );
  for (const r of selected) {
    if (!r.name.trim()) throw Error("Each item needs a name.");
    if (!Number.isFinite(r.quantity) || r.quantity <= 0)
      throw Error("Check each quantity.");
    if (r.expiry && !validDate(r.expiry))
      throw Error("Check each expiry date.");
    if (r.shoppingId) {
      const before = baseline.shopping.find((s) => s.id === r.shoppingId),
        now = current.shopping.find((s) => s.id === r.shoppingId);
      if (!before?.checked || JSON.stringify(before) !== JSON.stringify(now))
        throw Error(
          "A selected shopping item changed or was already put away. Reopen the review.",
        );
    }
    const notes = r.notes.trim();
    const same = merge
      ? next.foods.find(
          (f) =>
            productKey(f.name) === productKey(r.name) &&
            f.unit === r.unit &&
            f.location === r.location &&
            f.category === r.category &&
            f.expiry === r.expiry &&
            f.dateType === r.dateType &&
            f.notes === notes &&
            f.value === undefined,
        )
      : undefined;
    if (same) {
      const original = baseline.foods.find((f) => f.id === same.id);
      if (
        original &&
        JSON.stringify(original) !==
          JSON.stringify(current.foods.find((f) => f.id === same.id))
      )
        throw Error(
          "An existing batch changed. Reopen the review before combining.",
        );
      same.quantity += r.quantity;
      ids.push(same.id);
    } else {
      const f: Food = {
        id: crypto.randomUUID(),
        name: r.name.trim(),
        quantity: r.quantity,
        unit: r.unit,
        category: r.category,
        location: r.location,
        added: today,
        expiry: r.expiry,
        dateType: r.dateType,
        notes,
      };
      next.foods.push(f);
      ids.push(f.id);
    }
    if (r.shoppingId)
      next.shopping = next.shopping.filter((s) => s.id !== r.shoppingId);
  }
  return { data: validateBackup(next), ids };
}
