import {
  eligible,
  daysUntil,
  localDate,
  consume,
  type Data,
  type Food,
} from "../core";
import { ingredientKey } from "./ingredients";
import { templates, compose } from "./templates";
import { recipes } from "./library";
import type { Ingredient, Recipe } from "./types";
export type Allocation = { id: string; amount: number };
export type IngredientMatch = {
  ingredient: Ingredient;
  status: "available" | "assumed" | "missing" | "short" | "verify";
  shortage: number;
  allocations: Allocation[];
  note: string;
};
export type Match = Recipe & {
  missing: Ingredient[];
  available: number;
  urgent: number;
  urgentNames: string[];
  checks: IngredientMatch[];
  verification: string[];
  state:
    | "Ready to cook"
    | "Mostly available"
    | "Missing ingredients"
    | "Requires ingredient verification";
  score: number;
};
export type Personal = {
  favorites: Recipe[];
  history: { recipe: Recipe; date: string; servings: number }[];
  exclusions: string[];
  allergens?: string[];
};
export const emptyPersonal = (): Personal => ({
  favorites: [],
  history: [],
  exclusions: [],
});
export function measure(quantity: number, unit: string) {
  const u = unit.toLowerCase().trim();
  if (["kg", "kilogram", "kilograms"].includes(u))
    return { quantity: quantity * 1000, unit: "g" };
  if (["l", "litre", "liter", "litres"].includes(u))
    return { quantity: quantity * 1000, unit: "ml" };
  if (u === "tbsp") return { quantity: quantity * 15, unit: "ml" };
  if (u === "tsp") return { quantity: quantity * 5, unit: "ml" };
  if (["piece", "pieces", "egg", "eggs", "clove", "cloves"].includes(u))
    return { quantity, unit: "pieces" };
  if (u === "slice" || u === "slices") return { quantity, unit: "slices" };
  return { quantity, unit: u };
}
export function scaled(i: Ingredient, servings: number, base = 2): Ingredient {
  const quantity = Math.round(((i.quantity * servings) / base) * 1000) / 1000;
  return { ...i, quantity, amount: `${quantity} ${i.unit}` };
}
const pantryAllowed = new Set([
  "salt",
  "pepper",
  "oil",
  "water",
  "ground paprika",
  "cumin",
  "pasta",
  "rice",
  "noodle",
  "couscous",
  "oats",
  "flour",
]);
export function checkIngredient(
  i: Ingredient,
  data: Data,
  today = localDate(),
): IngredientMatch {
  const key = ingredientKey(i.name),
    safe = data.foods
      .filter((f) => eligible(f, today) && ingredientKey(f.name) === key)
      .sort(
        (a, b) =>
          daysUntil(a, today) - daysUntil(b, today) || a.id.localeCompare(b.id),
      );
  const need = measure(i.quantity, i.unit);
  let remaining = need.quantity;
  const allocations: Allocation[] = [];
  let unknown = false,
    form = false;
  for (const f of safe) {
    if (f.quantityUnknown) {
      unknown = true;
      continue;
    }
    const available = measure(f.quantity, f.unit);
    if (available.unit !== need.unit) {
      unknown = true;
      continue;
    }
    const amount = Math.min(remaining, available.quantity);
    if (amount > 0) {
      allocations.push({
        id: f.id,
        amount: (amount / available.quantity) * f.quantity,
      });
      remaining -= amount;
      if (
        (/cooked|canned/.test(i.form ?? "") &&
          !/canned|tinned|cooked|blik|gekookt/i.test(f.name + " " + f.notes)) ||
        (/dry/.test(i.form ?? "") &&
          (f.category === "Cooked leftovers" ||
            /cooked|gekookt/i.test(f.name))) ||
        i.name === "cooked rice" ||
        f.category === "Cooked leftovers" ||
        f.location === "Freezer"
      )
        form = true;
    }
  }
  const assumed =
    !safe.length &&
    pantryAllowed.has(key) &&
    !data.foods.some(
      (f) => ingredientKey(f.name) === key && daysUntil(f, today) < 0,
    ) &&
    data.settings.staples.some((s) => ingredientKey(s) === key);
  const status = assumed
    ? "assumed"
    : remaining <= 0.000001
      ? form
        ? "verify"
        : "available"
      : unknown
        ? "verify"
        : safe.length
          ? "short"
          : "missing";
  return {
    ingredient: i,
    status,
    shortage: Math.max(0, remaining),
    allocations,
    note:
      status === "assumed"
        ? "Pantry assumption; check quantity and label."
        : status === "verify"
          ? "Check units, preparation form, thawing and quantity before cooking."
          : status === "short"
            ? `Not enough: need another ${Math.round(remaining * 1000) / 1000} ${need.unit}.`
            : status === "missing"
              ? "Not in eligible inventory."
              : "Quantity available.",
  };
}
export function evaluate(
  recipe: Recipe,
  data: Data,
  today = localDate(),
  servings = recipe.servings,
  cache?: Map<string, IngredientMatch>,
): Match {
  const ingredients = recipe.ingredients.map((i) =>
    scaled(i, servings, recipe.servings),
  );
  const checks = ingredients.map((i) => {
    const key = JSON.stringify(i);
    const existing = cache?.get(key);
    if (existing) return existing;
    const match = checkIngredient(i, data, today);
    cache?.set(key, match);
    return match;
  });
  const missing = checks
    .filter((c) => c.status === "missing" || c.status === "short")
    .map((c) => ({
      ...c.ingredient,
      quantity: c.shortage,
      unit: measure(c.ingredient.quantity, c.ingredient.unit).unit,
      amount: `${Math.round(c.shortage * 1000) / 1000} ${measure(c.ingredient.quantity, c.ingredient.unit).unit}`,
    }));
  const verification = checks
    .filter((c) => c.status === "verify")
    .map((c) => c.ingredient.name);
  const urgentNames = checks
    .filter((c) =>
      c.allocations.some((a) => {
        const f = data.foods.find((f) => f.id === a.id)!;
        return daysUntil(f, today) <= 3;
      }),
    )
    .map((c) => c.ingredient.name);
  const available = checks.filter(
    (c) => c.status === "available" || c.status === "assumed",
  ).length;
  const state = missing.length
    ? missing.length <= 2
      ? "Mostly available"
      : "Missing ingredients"
    : verification.length
      ? "Requires ingredient verification"
      : "Ready to cook";
  return {
    ...recipe,
    ingredients,
    servings,
    missing,
    checks,
    verification,
    available,
    urgent: urgentNames.length,
    urgentNames,
    state,
    score:
      (available / checks.length) * 100 +
      urgentNames.length * 6 -
      missing.length * 4 -
      verification.length * 3 -
      recipe.time * 0.08,
  };
}
export function generate(data: Data, today = localDate()): Recipe[] {
  const safe = new Set(
    data.foods
      .filter((f) => eligible(f, today))
      .map((f) => ingredientKey(f.name)),
  );
  const result: Recipe[] = [];
  for (const t of templates) {
    const base = t.bases.find((b) => safe.has(b));
    if (!base) continue;
    const ps = t.proteins.filter((p) => safe.has(p));
    const vs = t.vegetables
      .filter((v) => safe.has(v))
      .sort((a, b) => {
        const urgency = (k: string) =>
          Math.min(
            ...data.foods
              .filter((f) => ingredientKey(f.name) === k && eligible(f, today))
              .map((f) => daysUntil(f, today)),
          );
        return urgency(a) - urgency(b) || a.localeCompare(b);
      });
    for (const p of ps.slice(0, 3))
      for (let n = 0; n < Math.min(vs.length, 3); n++) {
        const vegetables = vs.slice(n, n + 2);
        if (!vegetables.length) continue;
        const flavour =
          t.flavours.find((f) =>
            f === "plain" || f === "stock"
              ? f === "plain" || safe.has("vegetable stock")
              : safe.has(
                  f === "soy"
                    ? "soy sauce"
                    : f === "lemon"
                      ? "lemon"
                      : f === "tomato"
                        ? "canned tomato"
                        : "ground paprika",
                ),
          ) ?? t.flavours[0];
        result.push(compose(t, base, p, vegetables, flavour));
      }
  }
  return [...new Map(result.map((r) => [r.id, r])).values()];
}
export function preferenceAllows(r: Recipe, data: Data, personal: Personal) {
  return (
    !r.ingredients.some((i) =>
      personal.exclusions.some(
        (x) => ingredientKey(x) === ingredientKey(i.name),
      ),
    ) &&
    data.settings.diet.every((t) => r.tags.includes(t)) &&
    !(personal.allergens ?? []).some(
      (a) =>
        r.allergens.some((label) => label.toLowerCase().includes(a)) ||
        r.allergens.some((label) => /check.*label/i.test(label)),
    )
  );
}
export function recommendations(
  data: Data,
  today = localDate(),
  personal = emptyPersonal(),
  servings = 2,
): Match[] {
  const all = [...generate(data, today), ...recipes];
  const signatures = new Set<string>();
  const cache = new Map<string, IngredientMatch>();
  return all
    .filter((r) => {
      const sig = [
        r.template ?? r.id,
        ...r.ingredients.map((i) => i.name).sort(),
      ].join("|");
      if (signatures.has(sig)) return false;
      signatures.add(sig);
      return preferenceAllows(r, data, personal);
    })
    .map((r) => {
      const m = evaluate(r, data, today, servings, cache);
      const repeats = personal.history
        .slice(0, 5)
        .filter((h) => h.recipe.id === r.id).length;
      return { ...m, score: m.score - repeats * 8 };
    })
    .sort(
      (a, b) =>
        Number(a.state !== "Ready to cook") -
          Number(b.state !== "Ready to cook") ||
        b.score - a.score ||
        a.id.localeCompare(b.id),
    );
}
export function recipeShopping(data: Data, match: Match): Data {
  const next = structuredClone(data);
  for (const i of match.missing) {
    const existing = next.shopping.find(
      (s) => ingredientKey(s.name) === ingredientKey(i.name),
    );
    const q = measure(i.quantity, i.unit);
    if (existing && !existing.checked) {
      const m = existing.quantity.match(/^(\d*\.?\d+)\s+(\w+)$/);
      if (m) {
        const old = measure(Number(m[1]), m[2]);
        if (old.unit === q.unit) {
          existing.quantity = `${Math.max(old.quantity, q.quantity)} ${q.unit}`;
          continue;
        }
      }
      if (existing.notes?.includes(`Recipe needs ${i.amount};`)) continue;
      existing.notes = [
        existing.notes,
        `Recipe needs ${i.amount}; check existing list quantity.`,
      ]
        .filter(Boolean)
        .join(" ")
        .slice(0, 500);
      continue;
    }
    if (existing) {
      existing.checked = false;
      existing.quantity = i.amount;
      delete existing.purchasedAt;
    } else
      next.shopping.push({
        id: crypto.randomUUID(),
        name: i.name,
        quantity: i.amount,
        checked: false,
      });
  }
  return next;
}
export function confirmCooking(
  data: Data,
  recipe: Recipe,
  amounts: Record<string, number>,
  today = localDate(),
): Data {
  let next = data;
  for (const [id, amount] of Object.entries(amounts)) {
    if (!Number.isFinite(amount) || amount < 0)
      throw Error("Enter a valid non-negative quantity.");
    if (!amount) continue;
    const f = data.foods.find((f) => f.id === id);
    if (
      !f ||
      f.quantityUnknown ||
      !eligible(f, today) ||
      !recipe.ingredients.some(
        (i) => ingredientKey(i.name) === ingredientKey(f.name),
      )
    )
      throw Error(
        "Inventory changed or food is no longer eligible. Recheck your amounts.",
      );
    next = consume(next, id, amount, "used", today);
  }
  return next;
}
export function diversity(matches: Match[], limit = 6) {
  const seen = new Map<string, number>();
  return [...matches]
    .sort((a, b) => b.score - a.score)
    .filter((m) => {
      const k = m.template ?? m.category;
      const count = seen.get(k) ?? 0;
      if (count >= 2) return false;
      seen.set(k, count + 1);
      return true;
    })
    .slice(0, limit);
}
export function eligibleFoods(
  data: Data,
  recipe: Recipe,
  today = localDate(),
): Food[] {
  return data.foods.filter(
    (f) =>
      eligible(f, today) &&
      recipe.ingredients.some(
        (i) => ingredientKey(i.name) === ingredientKey(f.name),
      ),
  );
}
export { recipes } from "./library";
export { templates } from "./templates";
export type { Recipe, Ingredient } from "./types";
