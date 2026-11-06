export const categories = [
  "Produce",
  "Dairy",
  "Meat & fish",
  "Bread & bakery",
  "Cooked leftovers",
  "Drinks",
  "Frozen food",
  "Pantry",
  "Other",
] as const;
export const locations = ["Fridge", "Freezer", "Pantry"] as const;
export type Food = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: (typeof categories)[number];
  location: (typeof locations)[number];
  added: string;
  expiry: string;
  dateType: "use-by" | "best-before";
  notes: string;
  value?: number;
};
export type Shopping = {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
  priority?: boolean;
  category?: (typeof categories)[number];
  notes?: string;
  purchasedAt?: string;
};
export type Frequent = {
  id: string;
  name: string;
  quantity: string;
  count: number;
  lastPurchased: string;
};
export type Event = {
  id: string;
  food: Food;
  amount: number;
  action: "eaten" | "used" | "discarded";
  date: string;
  value?: number;
};
export type Settings = {
  theme: "light" | "dark" | "system";
  staples: string[];
  diet: string[];
  currency: string;
};
export type Data = {
  version: 1;
  foods: Food[];
  shopping: Shopping[];
  frequent?: Frequent[];
  events: Event[];
  settings: Settings;
  demo: boolean;
};
export const defaults: Settings = {
  theme: "system",
  staples: ["salt", "pepper", "oil", "water"],
  diet: [],
  currency: "USD",
};
export const emptyData = (): Data => ({
  version: 1,
  foods: [],
  shopping: [],
  events: [],
  settings: { ...defaults },
  demo: false,
});
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function dayNumber(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}
export function validDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00`);
  return !isNaN(+d) && localDate(d) === s;
}
export function daysUntil(f: Food, today = localDate()) {
  return f.expiry ? dayNumber(f.expiry) - dayNumber(today) : Infinity;
}
export function status(f: Food, today = localDate()) {
  const n = daysUntil(f, today);
  return n < 0
    ? f.dateType === "use-by"
      ? "Past use-by"
      : "Past best-before"
    : n === 0
      ? "Today"
      : n === 1
        ? "Tomorrow"
        : n <= 3
          ? "Next 3 days"
          : n === Infinity
            ? "No date"
            : "Later";
}
export function eligible(f: Food, today = localDate()) {
  return daysUntil(f, today) >= 0 && f.quantity > 0;
}
export function consume(
  data: Data,
  id: string,
  amount: number,
  action: Event["action"],
  date = localDate(),
): Data {
  const f = data.foods.find((x) => x.id === id);
  if (!f || !Number.isFinite(amount) || amount <= 0 || amount > f.quantity)
    throw Error("Choose a quantity within the amount remaining.");
  const value =
    f.value === undefined ? undefined : (f.value * amount) / f.quantity;
  return {
    ...data,
    foods: data.foods.flatMap((x) =>
      x.id !== id
        ? [x]
        : x.quantity === amount
          ? []
          : [
              {
                ...x,
                quantity: x.quantity - amount,
                value:
                  x.value === undefined ? undefined : x.value - (value ?? 0),
              },
            ],
    ),
    events: [
      ...data.events,
      { id: crypto.randomUUID(), food: { ...f }, amount, action, date, value },
    ],
  };
}
export function wasteStats(events: Event[], today = localDate()) {
  const n = dayNumber(today);
  const weekStart = n - ((new Date(`${today}T12:00:00`).getDay() + 6) % 7);
  const discarded = events.filter((e) => e.action === "discarded");
  return {
    discarded,
    week: discarded.filter(
      (e) => dayNumber(e.date) >= weekStart && dayNumber(e.date) <= n,
    ).length,
    month: discarded.filter((e) => e.date.slice(0, 7) === today.slice(0, 7))
      .length,
    priced: discarded.filter((e) => e.value !== undefined),
    value: discarded.reduce((a, e) => a + (e.value ?? 0), 0),
  };
}
export function normalize(s: string) {
  const aliases: Record<string, string> = {
    tomatoes: "tomato",
    eggs: "egg",
    potatoes: "potato",
    carrots: "carrot",
    onions: "onion",
    peppers: "bell pepper",
    "red pepper": "bell pepper",
    "green pepper": "bell pepper",
    capsicum: "bell pepper",
    courgette: "zucchini",
    aubergine: "eggplant",
    scallions: "spring onion",
    "green onion": "spring onion",
    cheddar: "cheese",
    "cheddar cheese": "cheese",
    "pasta noodles": "pasta",
    chickpeas: "chickpea",
    lentils: "lentil",
    "rolled oats": "oats",
    tortillas: "tortilla",
    "canned tomatoes": "canned tomato",
    "tinned tomatoes": "canned tomato",
    "canned chickpeas": "chickpea",
    "tinned chickpeas": "chickpea",
    bananas: "banana",
    apples: "apple",
    mushrooms: "mushroom",
    lemons: "lemon",
    "spinach leaves": "spinach",
    "white rice": "rice",
    "brown rice": "rice",
    "olive oil": "oil",
    "vegetable oil": "oil",
    "greek yogurt": "yogurt",
    "plain yogurt": "yogurt",
  };
  const v = s.toLowerCase().trim().replace(/\s+/g, " ");
  return Object.hasOwn(aliases, v) ? aliases[v] : v;
}
export function addShopping(data: Data, names: string[]): Data {
  const exists = new Set(data.shopping.map((s) => normalize(s.name)));
  return {
    ...data,
    shopping: [
      ...data.shopping.map((s) =>
        names.some((n) => normalize(n) === normalize(s.name)) && s.checked
          ? { ...s, checked: false, purchasedAt: undefined }
          : s,
      ),
      ...names
        .filter((n) => {
          const key = normalize(n);
          if (exists.has(key)) return false;
          exists.add(key);
          return true;
        })
        .map((name) => ({
          id: crypto.randomUUID(),
          name,
          quantity: "",
          checked: false,
        })),
    ],
  };
}
export function validateBackup(input: unknown): Data {
  const fail = () => {
    throw Error(
      "Invalid backup. Choose a complete EatFirst version 1 JSON export.",
    );
  };
  if (!input || typeof input !== "object") return fail();
  const d = input as Data;
  const str = (s: unknown) => typeof s === "string" && s.length <= 10000;
  const num = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0;
  const food = (f: Food) =>
    f &&
    str(f.id) &&
    str(f.name) &&
    f.name.trim().length > 0 &&
    num(f.quantity) &&
    f.quantity > 0 &&
    str(f.unit) &&
    categories.includes(f.category) &&
    locations.includes(f.location) &&
    validDate(f.added) &&
    (!f.expiry || validDate(f.expiry)) &&
    ["use-by", "best-before"].includes(f.dateType) &&
    str(f.notes) &&
    (f.value === undefined || num(f.value));
  if (
    d.version !== 1 ||
    !Array.isArray(d.foods) ||
    !Array.isArray(d.shopping) ||
    !Array.isArray(d.events) ||
    d.foods.length + d.shopping.length + d.events.length > 50000
  )
    return fail();
  if (
    !d.foods.every(food) ||
    !d.shopping.every(
      (s) =>
        s &&
        str(s.id) &&
        str(s.name) &&
        !!s.name.trim() &&
        str(s.quantity) &&
        typeof s.checked === "boolean",
    ) ||
    !d.events.every(
      (e) =>
        e &&
        str(e.id) &&
        food(e.food) &&
        num(e.amount) &&
        e.amount > 0 &&
        e.amount <= e.food.quantity &&
        ["eaten", "used", "discarded"].includes(e.action) &&
        validDate(e.date) &&
        (e.value === undefined || num(e.value)),
    )
  )
    return fail();
  const s = d.settings;
  if (
    !s ||
    !["light", "dark", "system"].includes(s.theme) ||
    !Array.isArray(s.staples) ||
    !s.staples.every(str) ||
    !Array.isArray(s.diet) ||
    !s.diet.every((x) => ["vegetarian", "vegan", "gluten-free"].includes(x)) ||
    !["USD", "GBP", "EUR", "CAD", "AUD"].includes(s.currency) ||
    typeof d.demo !== "boolean"
  )
    return fail();
  for (const list of [d.foods, d.shopping, d.events])
    if (new Set(list.map((x) => x.id)).size !== list.length) return fail();
  if (
    d.frequent !== undefined &&
    (!Array.isArray(d.frequent) ||
      !d.frequent.every(
        (f) =>
          f &&
          str(f.id) &&
          str(f.name) &&
          str(f.quantity) &&
          num(f.count) &&
          Number.isInteger(f.count) &&
          validDate(f.lastPurchased),
      ) ||
      new Set(d.frequent.map((f) => f.id)).size !== d.frequent.length)
  )
    return fail();
  if (
    !d.shopping.every(
      (s) =>
        (s.priority === undefined || typeof s.priority === "boolean") &&
        (s.category === undefined || categories.includes(s.category)) &&
        (s.notes === undefined || str(s.notes)) &&
        (s.purchasedAt === undefined || validDate(s.purchasedAt)),
    )
  )
    return fail();
  return structuredClone(d);
}

export function purchaseItem(
  data: Data,
  id: string,
  checked: boolean,
  today = localDate(),
): Data {
  const item = data.shopping.find((s) => s.id === id);
  if (!item) throw Error("Shopping item no longer exists.");
  let frequent = data.frequent ?? [];
  if (checked && !item.checked) {
    const key = normalize(item.name);
    const prev = frequent.find((f) => f.id === key);
    frequent = [
      ...frequent.filter((f) => f.id !== key),
      {
        id: key,
        name: item.name,
        quantity: item.quantity,
        count: (prev?.count ?? 0) + 1,
        lastPurchased: today,
      },
    ];
  }
  return {
    ...data,
    frequent,
    shopping: data.shopping.map((s) =>
      s.id === id
        ? { ...s, checked, purchasedAt: checked ? today : undefined }
        : s,
    ),
  };
}
