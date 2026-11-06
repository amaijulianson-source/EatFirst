import { photoRecipes } from "./photo-recipes";
import { recipes as legacy } from "./legacy";
import { ingredientKey, profiles } from "./ingredients";
import { compose, templates } from "./templates";
import type { Recipe, Ingredient } from "./types";
const selections: Record<string, string[]> = {
  pasta: [
    "chicken:broccoli+carrot:tomato",
    "tofu:mushroom+spinach:lemon",
    "white bean:zucchini+tomato:tomato",
    "salmon:spinach+pea:lemon",
    "cod:leek+tomato:tomato",
    "chickpea:bell pepper+zucchini:tomato",
    "lentil:mushroom+carrot:tomato",
  ],
  "rice-bowl": [
    "chicken:broccoli+carrot:soy",
    "tofu:bell pepper+mushroom:soy",
    "salmon:broccoli+pea:lemon",
    "chickpea:spinach+carrot:lemon",
    "white bean:leek+tomato:lemon",
    "cod:zucchini+pea:lemon",
    "kidney bean:cabbage+bell pepper:soy",
  ],
  "fried-rice": [
    "chicken:broccoli+carrot:soy",
    "tofu:pea+carrot:soy",
    "egg:bell pepper+pea:soy",
    "chickpea:cabbage+carrot:soy",
    "chicken:mushroom+spinach:soy",
    "tofu:zucchini+bell pepper:soy",
    "egg:leek+mushroom:soy",
  ],
  "stir-fry": [
    "chicken:broccoli+carrot:soy",
    "tofu:mushroom+bell pepper:soy",
    "salmon:broccoli+pea:soy",
    "chickpea:cabbage+carrot:soy",
    "white bean:green bean+bell pepper:soy",
    "cod:zucchini+leek:soy",
    "lentil:spinach+tomato:soy",
  ],
  omelette: [
    "cheese:spinach+mushroom:plain",
    "feta:tomato+spinach:plain",
    "cheese:bell pepper+leek:plain",
    "feta:zucchini+tomato:plain",
    "cheese:pea+carrot:plain",
    "feta:mushroom+leek:plain",
    "cheese:cabbage+tomato:plain",
  ],
  scramble: [
    "cheese:spinach+tomato:plain",
    "feta:mushroom+spinach:plain",
    "cheese:bell pepper+tomato:plain",
    "feta:leek+mushroom:plain",
    "cheese:leek+spinach:plain",
    "feta:bell pepper+spinach:plain",
    "cheese:mushroom+tomato:plain",
  ],
  soup: [
    "chicken:carrot+leek:stock",
    "white bean:cabbage+tomato:tomato",
    "chickpea:carrot+spinach:stock",
    "lentil:mushroom+carrot:tomato",
    "cod:leek+pea:stock",
    "tofu:broccoli+cauliflower:stock",
    "salmon:spinach+leek:stock",
  ],
  roast: [
    "chickpea:cauliflower+carrot:paprika",
    "tofu:broccoli+mushroom:lemon",
    "feta:bell pepper+zucchini:lemon",
    "white bean:sweet potato+carrot:paprika",
    "chickpea:zucchini+bell pepper:lemon",
    "tofu:cauliflower+carrot:paprika",
    "feta:broccoli+mushroom:lemon",
  ],
  skillet: [
    "chicken:mushroom+spinach:paprika",
    "white bean:tomato+leek:tomato",
    "tofu:bell pepper+zucchini:paprika",
    "salmon:pea+spinach:tomato",
    "chickpea:carrot+cabbage:paprika",
    "cod:leek+tomato:tomato",
    "kidney bean:bell pepper+carrot:tomato",
  ],
  salad: [
    "feta:cucumber+tomato:lemon",
    "chickpea:carrot+radish:lemon",
    "white bean:cucumber+radish:lemon",
    "cheese:tomato+carrot:lemon",
    "feta:carrot+cucumber:lemon",
    "chickpea:tomato+radish:lemon",
    "white bean:carrot+tomato:lemon",
  ],
  sandwich: [
    "cheese:tomato+lettuce:plain",
    "feta:cucumber+tomato:lemon",
    "chickpea:carrot+lettuce:lemon",
    "white bean:radish+cucumber:lemon",
    "cheese:cucumber+radish:plain",
    "feta:carrot+lettuce:plain",
    "chickpea:tomato+cucumber:lemon",
  ],
  wrap: [
    "chicken:bell pepper+spinach:paprika",
    "tofu:mushroom+carrot:lemon",
    "chickpea:zucchini+tomato:paprika",
    "salmon:spinach+tomato:lemon",
    "white bean:bell pepper+carrot:paprika",
    "cod:zucchini+spinach:lemon",
    "kidney bean:tomato+bell pepper:paprika",
  ],
  "baked-potato": [
    "cheese:mushroom+spinach:plain",
    "feta:tomato+spinach:plain",
    "chickpea:bell pepper+tomato:plain",
    "white bean:leek+mushroom:plain",
    "tofu:bell pepper+spinach:plain",
    "cheese:leek+tomato:plain",
    "feta:mushroom+bell pepper:plain",
  ],
  fritter: [
    "egg:carrot+zucchini:plain",
    "egg:potato+carrot:plain",
    "egg:sweet potato+zucchini:plain",
    "egg:carrot:plain",
    "egg:zucchini:plain",
    "egg:potato:plain",
    "egg:sweet potato:plain",
  ],
  "grain-bowl": [
    "feta:tomato+cucumber:lemon",
    "chickpea:carrot+radish:lemon",
    "white bean:tomato+lettuce:lemon",
    "cheese:cucumber+carrot:lemon",
    "feta:radish+lettuce:lemon",
    "chickpea:tomato+cucumber:lemon",
    "white bean:carrot+lettuce:lemon",
  ],
  casserole: [
    "chicken:broccoli+carrot:tomato",
    "tofu:mushroom+spinach:tomato",
    "white bean:zucchini+tomato:tomato",
    "salmon:pea+leek:tomato",
    "chickpea:bell pepper+cauliflower:tomato",
    "lentil:carrot+mushroom:tomato",
    "cod:spinach+zucchini:tomato",
  ],
  noodles: [
    "chicken:broccoli+carrot:soy",
    "tofu:cabbage+mushroom:soy",
    "salmon:spinach+pea:soy",
    "chickpea:bell pepper+zucchini:soy",
    "white bean:green bean+carrot:soy",
    "cod:leek+broccoli:soy",
    "tofu:cauliflower+bell pepper:soy",
  ],
  breakfast: [
    "milk:banana:plain",
    "yogurt:apple:plain",
    "milk:pear:plain",
    "yogurt:berry:plain",
    "milk:banana+berry:plain",
    "yogurt:apple+pear:plain",
    "milk:apple+berry:plain",
  ],
};
export function parseIngredient(name: string, amount: string): Ingredient {
  name = ingredientKey(name);
  if (name === "rice" && /cooked/.test(amount)) name = "cooked rice";
  const match = amount.match(/^(\d+(?:\.\d+)?|\d+\/\d+)\s*(.*)$/);
  let quantity = 1,
    unit = "pieces";
  if (match) {
    quantity = match[1].includes("/")
      ? Number(match[1].split("/")[0]) / Number(match[1].split("/")[1])
      : Number(match[1]);
    unit = match[2].trim().split(" ")[0] || "pieces";
  } else unit = amount === "pinch" ? "pinch" : "check";
  return {
    name,
    amount,
    quantity,
    unit,
    form: /cooked/.test(amount)
      ? "cooked"
      : match?.[2].trim().split(" ").slice(1).join(" ") || undefined,
  };
}
export const recipes: Recipe[] = [
  ...photoRecipes,
  ...legacy.map((r) => ({
    ...r,
    category: /soup/i.test(r.name)
      ? "Soup"
      : /pasta/i.test(r.name)
        ? "Pasta"
        : /toast|omelette|oat/i.test(r.name)
          ? "Breakfast"
          : "Everyday",
    prepTime: 5,
    cookTime: Math.max(0, r.time - 5),
    servings: 2,
    ingredients: r.ingredients.map((i) => parseIngredient(i.name, i.amount)),
    tags: r.tags.filter((t) => t !== "gluten-free"),
    allergens: [
      ...new Set(
        r.ingredients.flatMap(
          (i) =>
            profiles[ingredientKey(i.name)]?.allergens ?? [
              "Check product label",
            ],
        ),
      ),
    ],
    substitutions: [
      "Check the adaptive suggestions for a recalculated alternative; do not swap raw meat into a ready-to-eat recipe.",
    ],
    safety: [
      "Check product labels and storage history. Keep raw meat/fish separate from ready-to-eat ingredients. Cook chicken to 74°C / 165°F, fish to 63°C / 145°F and egg dishes to 71°C / 160°F.",
      "Refrigerate leftovers within 2 hours. Cool rice within 1 hour, refrigerate, use within 24 hours and reheat once only. Never use past use-by food.",
    ],
    source: "curated" as const,
  })),
  ...templates.flatMap((t) =>
    selections[t.id].map((row) => {
      const [protein, vegetables, flavour] = row.split(":");
      return compose(
        t,
        t.bases[0],
        protein,
        vegetables.split("+"),
        flavour,
        "curated",
      );
    }),
  ),
];
