import { db } from "../db";
import { emptyPersonal, type Personal } from "./engine";
import type { Recipe } from "./types";
export function validatePersonal(value: unknown): Personal {
  if (!value || typeof value !== "object")
    throw Error("Invalid recipe backup.");
  const p = value as Personal;
  const recipe = (r: Recipe) =>
    r &&
    typeof r.id === "string" &&
    r.id.length < 300 &&
    typeof r.name === "string" &&
    r.name.length < 300 &&
    typeof r.description === "string" &&
    r.description.length < 1000 &&
    typeof r.category === "string" &&
    r.category.length < 100 &&
    ["curated", "adaptive"].includes(r.source) &&
    ["sage", "gold", "peach", "lavender"].includes(r.color) &&
    Number.isFinite(r.prepTime) &&
    r.prepTime >= 0 &&
    Number.isFinite(r.cookTime) &&
    r.cookTime >= 0 &&
    Array.isArray(r.ingredients) &&
    r.ingredients.length > 0 &&
    r.ingredients.length <= 30 &&
    r.ingredients.every(
      (i) =>
        typeof i.name === "string" &&
        i.name.length < 100 &&
        typeof i.amount === "string" &&
        i.amount.length < 100 &&
        Number.isFinite(i.quantity) &&
        i.quantity > 0 &&
        typeof i.unit === "string",
    ) &&
    Array.isArray(r.steps) &&
    r.steps.length >= 3 &&
    r.steps.length <= 20 &&
    r.steps.every((s) => typeof s === "string" && s.length < 3000) &&
    Array.isArray(r.tags) &&
    Array.isArray(r.allergens) &&
    Array.isArray(r.safety) &&
    Array.isArray(r.substitutions) &&
    [r.tags, r.allergens, r.safety, r.substitutions].every(
      (list) =>
        list.length < 30 &&
        list.every((s) => typeof s === "string" && s.length < 3000),
    ) &&
    Number.isFinite(r.time) &&
    Number.isFinite(r.servings) &&
    r.servings >= 1 &&
    r.servings <= 12;
  if (
    !Array.isArray(p.favorites) ||
    p.favorites.length > 200 ||
    !p.favorites.every(recipe) ||
    !Array.isArray(p.history) ||
    p.history.length > 100 ||
    !p.history.every(
      (h) =>
        recipe(h.recipe) &&
        typeof h.date === "string" &&
        Number.isFinite(Date.parse(h.date)) &&
        Number.isFinite(h.servings) &&
        h.servings >= 1 &&
        h.servings <= 12,
    ) ||
    !Array.isArray(p.exclusions) ||
    p.exclusions.length > 100 ||
    !p.exclusions.every((x) => typeof x === "string" && x.length < 100)
  )
    throw Error("Invalid recipe backup. Nothing was imported.");
  if (
    p.allergens !== undefined &&
    (!Array.isArray(p.allergens) ||
      p.allergens.length > 20 ||
      !p.allergens.every((a) => typeof a === "string" && a.length < 50))
  )
    throw Error("Invalid allergen preferences.");
  return p;
}
export async function readPersonal(key: string) {
  const row = await db.caches.get(key);
  return row ? validatePersonal(row.value) : emptyPersonal();
}
export async function changePersonal(
  key: string,
  fn: (p: Personal) => Personal,
) {
  return db.transaction("rw", db.caches, async () => {
    const current = await readPersonal(key);
    const next = validatePersonal(fn(current));
    await db.caches.put({ id: key, value: next });
    return next;
  });
}
export function recipeSnapshot(r: Recipe): Recipe {
  const {
    id,
    name,
    description,
    category,
    prepTime,
    cookTime,
    time,
    difficulty,
    servings,
    steps,
    tags,
    allergens,
    substitutions,
    safety,
    color,
    source,
    template,
  } = r;
  return {
    id,
    name,
    description,
    category,
    prepTime,
    cookTime,
    time,
    difficulty,
    servings,
    ingredients: r.ingredients.map(
      ({ name, amount, quantity, unit, form }) => ({
        name,
        amount,
        quantity,
        unit,
        form,
      }),
    ),
    steps: [...steps],
    tags: [...tags],
    allergens: [...allergens],
    substitutions: [...substitutions],
    safety: [...safety],
    color,
    source,
    template,
  };
}
