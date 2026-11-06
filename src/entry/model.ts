import {
  type Data,
  type Food,
  type Shopping,
  localDate,
  validDate,
  validateBackup,
} from "../core";
import { ingredientKey, profiles } from "../cooking/ingredients";
export type DateCandidate = {
  raw: string;
  date: string;
  type?: Food["dateType"];
  review: boolean;
  reason: string;
};
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
  source: "manual" | "shopping" | "photo";
  sources: string[];
  review: string[];
  barcode?: string;
  shoppingId?: string;
  included: boolean;
  quantityEvidence?: "label" | "pattern" | "unverified" | "confirmed";
};
const rules: [RegExp, string, Food["category"], Food["location"]][] = [
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
  [/\b(?:koffie|coffee)\b/i, "Coffee", "Pantry", "Pantry"],
];
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
const monthNames: Record<string, number> = {
  jan: 1,
  januari: 1,
  january: 1,
  feb: 2,
  februari: 2,
  february: 2,
  mrt: 3,
  maart: 3,
  march: 3,
  mar: 3,
  apr: 4,
  april: 4,
  mei: 5,
  may: 5,
  jun: 6,
  juni: 6,
  june: 6,
  jul: 7,
  juli: 7,
  july: 7,
  aug: 8,
  augustus: 8,
  august: 8,
  sep: 9,
  september: 9,
  okt: 10,
  oct: 10,
  oktober: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};
export function extractDates(text: string): DateCandidate[] {
  const result: DateCandidate[] = [];
  const pattern =
    /\b(?:(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})|(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})|(\d{1,2})\s+(jan(?:uary|uari)?|feb(?:ruary|ruari)?|mrt|maart|mar(?:ch)?|apr(?:il)?|mei|may|jun[ei]?|jul[yi]?|aug(?:ustus|ust)?|sep(?:tember)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{2}|\d{4}))\b/gi;
  for (const m of text.matchAll(pattern)) {
    const context = text
      .slice(Math.max(0, m.index! - 65), m.index! + m[0].length + 10)
      .toLowerCase();
    const preceding = text.slice(Math.max(0, m.index! - 65), m.index!);
    const labels = [
      ...preceding.matchAll(
        /use[- ]?by|te gebruiken tot|\btgt\b|best[- ]?before|ten minste houdbaar|\btht\b/gi,
      ),
    ];
    const nearest = labels.at(-1)?.[0] ?? "";
    const type: Food["dateType"] | undefined =
      /use[- ]?by|te gebruiken tot|tgt/i.test(nearest)
        ? "use-by"
        : nearest
          ? "best-before"
          : undefined;
    if (
      !type &&
      /purchase|receipt|kassa|bon datum|aankoop|manufactur|productiedatum/.test(
        context,
      )
    )
      continue;
    const yy = m[1] ?? m[6] ?? m[9];
    const year = Number(yy.length === 2 ? "20" + yy : yy);
    const month = Number(m[2] ?? m[5] ?? monthNames[m[8]?.toLowerCase()]);
    const date = Number(m[3] ?? m[4] ?? m[7]);
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
    if (!validDate(iso)) continue;
    const review =
      !type || yy.length === 2 || (!m[1] && !m[8] && date <= 12 && month <= 12);
    result.push({
      raw: m[0],
      date: iso,
      type,
      review,
      reason: !type
        ? "Date found; confirm that it is an expiry date."
        : review
          ? "Read as day/month/year (two-digit years use 20xx). Confirm the package."
          : "Labelled expiry date; confirm against the package.",
    });
  }
  return [...new Map(result.map((d) => [d.date + ":" + d.type, d])).values()];
}
export function validBarcode(value: string) {
  if (!/^\d{8}$|^\d{12,14}$/.test(value)) return false;
  const d = value.split("").map(Number);
  const check = d.pop()!;
  const sum = d.reverse().reduce((s, n, i) => s + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
export function barcodeInText(text: string) {
  return [...new Set((text.match(/\b\d{8,14}\b/g) ?? []).filter(validBarcode))];
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
    location: memory?.location ?? n.location,
    expiry: "",
    barcode: memory?.barcode,
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
export function parsePhotoText(
  text: string,
  source: string,
  patterns: Pattern[] = [],
): { drafts: Draft[]; dates: DateCandidate[]; barcodes: string[] } {
  const dates = extractDates(text),
    barcodes = barcodeInText(text);
  const drafts: Draft[] = [];
  for (const line of text
    .split(/\n|;/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (
      /^(?:total|totaal|btw|vat|subtotal|subtotaal|change|pinbetaling|receipt|kassabon|best before|use by|tht|tgt|te gebruiken|ten minste)/i.test(
        line,
      )
    )
      continue;
    const n = normalizeProduct(line);
    if (!n.known) continue;
    const d = makeDraft(line, "photo", patterns);
    d.sources = [source];
    d.review.push(
      "Text recognition can be wrong. Confirm against the product.",
    );
    drafts.push(d);
  }
  if (drafts.length === 1 && dates.length === 1 && dates[0].type) {
    drafts[0].expiry = dates[0].date;
    drafts[0].dateType = dates[0].type;
    drafts[0].review.push(dates[0].reason);
  }
  for (const barcode of barcodes) {
    const p = patterns.find((p) => p.barcode === barcode);
    if (p && !drafts.some((d) => productKey(d.name) === productKey(p.name))) {
      const d = makeDraft(p.name, "photo", patterns);
      d.quantity = p.quantity;
      d.unit = p.unit;
      d.barcode = barcode;
      d.sources = [source];
      d.review.push("Barcode matched a saved pattern; verify the package.");
      drafts.push(d);
    } else if (drafts.length === 1) drafts[0].barcode = barcode;
  }
  return { drafts: mergeDetections(drafts), dates, barcodes };
}
export function mergeDetections(rows: Draft[]): Draft[] {
  const result: Draft[] = [];
  for (const row of rows) {
    const same = result.find(
      (r) =>
        r.source === "photo" &&
        row.source === "photo" &&
        productKey(r.name) === productKey(row.name) &&
        ((r.quantity === row.quantity && r.unit === row.unit) ||
          r.quantityEvidence === "unverified" ||
          row.quantityEvidence === "unverified") &&
        (!r.expiry ||
          !row.expiry ||
          (r.expiry === row.expiry && r.dateType === row.dateType)) &&
        (!r.barcode || !row.barcode || r.barcode === row.barcode),
    );
    if (same) {
      if (
        same.quantityEvidence === "unverified" &&
        row.quantityEvidence !== "unverified"
      ) {
        same.quantity = row.quantity;
        same.unit = row.unit;
        same.quantityEvidence = row.quantityEvidence;
      }
      if (!same.expiry && row.expiry) {
        same.expiry = row.expiry;
        same.dateType = row.dateType;
      }
      same.sources = [...new Set([...same.sources, ...row.sources])];
      same.review = [
        ...new Set([
          ...same.review,
          ...row.review,
          "May appear in multiple photos. Confirm the number of packages; quantities were not added.",
        ]),
      ];
      same.barcode ??= row.barcode;
    } else result.push(structuredClone(row));
  }
  return result;
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
      barcode: f.notes.match(/Barcode:\s*(\d{8,14})\b/)?.[1],
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
      (p.barcode !== undefined && !validBarcode(p.barcode))
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
      barcode: r.barcode ?? old?.barcode,
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
    const notes = [r.notes.trim(), r.barcode ? `Barcode: ${r.barcode}` : ""]
      .filter(Boolean)
      .join("\n");
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
export type ExpiryChange = {
  id: string;
  expiry: string;
  dateType: Food["dateType"];
};
export function assignDates(
  current: Data,
  changes: ExpiryChange[],
  baseline: Data,
) {
  const next = structuredClone(current);
  const ids = new Set<string>();
  for (const c of changes) {
    if (ids.has(c.id))
      throw Error(
        "Two scans target the same item. Choose the correct date first.",
      );
    ids.add(c.id);
    if (!validDate(c.expiry))
      throw Error("Choose a complete valid date, including the year.");
    const f = next.foods.find((f) => f.id === c.id),
      old = baseline.foods.find((f) => f.id === c.id);
    if (!f || !old || JSON.stringify(f) !== JSON.stringify(old))
      throw Error(
        "An item changed while you were assigning dates. Reopen the review.",
      );
    f.expiry = c.expiry;
    f.dateType = c.dateType;
  }
  return validateBackup(next);
}
