import { profiles } from "./ingredients";
import type { Ingredient, Recipe } from "./types";
export type Template = {
  id: string;
  label: string;
  category: string;
  prep: number;
  cook: number;
  bases: string[];
  proteins: string[];
  vegetables: string[];
  flavours: string[];
  suffix: string;
};
const warm = [
  "broccoli",
  "carrot",
  "spinach",
  "mushroom",
  "bell pepper",
  "zucchini",
  "tomato",
  "pea",
  "cauliflower",
  "sweet potato",
  "cabbage",
  "leek",
  "green bean",
];
const proteins = [
  "chicken",
  "salmon",
  "cod",
  "tofu",
  "chickpea",
  "white bean",
  "lentil",
  "kidney bean",
];
const cold = ["tomato", "cucumber", "lettuce", "carrot", "radish"];
export const templates: Template[] = [
  {
    id: "pasta",
    label: "Pasta dishes",
    category: "Pasta",
    prep: 10,
    cook: 20,
    bases: ["pasta"],
    proteins,
    vegetables: warm,
    flavours: ["tomato", "lemon"],
    suffix: "pasta",
  },
  {
    id: "rice-bowl",
    label: "Rice bowls",
    category: "Rice",
    prep: 10,
    cook: 20,
    bases: ["rice"],
    proteins,
    vegetables: warm,
    flavours: ["soy", "lemon"],
    suffix: "rice bowl",
  },
  {
    id: "fried-rice",
    label: "Fried rice",
    category: "Rice",
    prep: 10,
    cook: 25,
    bases: ["rice"],
    proteins: ["chicken", "tofu", "egg", "chickpea"],
    vegetables: warm,
    flavours: ["soy"],
    suffix: "fried rice",
  },
  {
    id: "stir-fry",
    label: "Stir-fries",
    category: "Stir-fry",
    prep: 10,
    cook: 20,
    bases: ["rice"],
    proteins,
    vegetables: warm.filter((x) => x !== "sweet potato"),
    flavours: ["soy"],
    suffix: "stir-fry",
  },
  {
    id: "omelette",
    label: "Omelettes",
    category: "Breakfast",
    prep: 5,
    cook: 12,
    bases: ["egg"],
    proteins: ["cheese", "feta"],
    vegetables: warm.filter(
      (x) =>
        !["sweet potato", "green bean", "cauliflower", "broccoli"].includes(x),
    ),
    flavours: ["plain"],
    suffix: "omelette",
  },
  {
    id: "scramble",
    label: "Scrambled eggs",
    category: "Breakfast",
    prep: 5,
    cook: 10,
    bases: ["egg"],
    proteins: ["cheese", "feta"],
    vegetables: ["spinach", "mushroom", "tomato", "bell pepper", "leek"],
    flavours: ["plain"],
    suffix: "scrambled eggs",
  },
  {
    id: "soup",
    label: "Soups",
    category: "Soup",
    prep: 10,
    cook: 25,
    bases: ["potato"],
    proteins,
    vegetables: warm,
    flavours: ["stock", "tomato"],
    suffix: "soup",
  },
  {
    id: "roast",
    label: "Roasted vegetables",
    category: "Oven",
    prep: 10,
    cook: 30,
    bases: ["potato"],
    proteins: ["tofu", "chickpea", "white bean", "feta"],
    vegetables: [
      "carrot",
      "cauliflower",
      "bell pepper",
      "zucchini",
      "sweet potato",
      "broccoli",
      "mushroom",
    ],
    flavours: ["lemon", "paprika"],
    suffix: "roasted tray",
  },
  {
    id: "skillet",
    label: "One-pan skillets",
    category: "One-pot",
    prep: 10,
    cook: 25,
    bases: ["potato"],
    proteins,
    vegetables: warm,
    flavours: ["paprika", "tomato"],
    suffix: "potato skillet",
  },
  {
    id: "salad",
    label: "Salads",
    category: "Salad",
    prep: 15,
    cook: 0,
    bases: ["lettuce"],
    proteins: ["chickpea", "white bean", "feta", "cheese"],
    vegetables: cold.filter((x) => x !== "lettuce"),
    flavours: ["lemon"],
    suffix: "salad",
  },
  {
    id: "sandwich",
    label: "Sandwiches",
    category: "Lunch",
    prep: 10,
    cook: 0,
    bases: ["bread"],
    proteins: ["cheese", "feta", "chickpea", "white bean"],
    vegetables: cold,
    flavours: ["plain", "lemon"],
    suffix: "sandwich",
  },
  {
    id: "wrap",
    label: "Wraps",
    category: "Wraps",
    prep: 10,
    cook: 15,
    bases: ["tortilla"],
    proteins,
    vegetables: [
      "spinach",
      "bell pepper",
      "mushroom",
      "tomato",
      "zucchini",
      "carrot",
    ],
    flavours: ["lemon", "paprika"],
    suffix: "wraps",
  },
  {
    id: "baked-potato",
    label: "Baked potatoes",
    category: "Potatoes",
    prep: 10,
    cook: 65,
    bases: ["potato"],
    proteins: ["cheese", "feta", "chickpea", "white bean", "tofu"],
    vegetables: ["spinach", "mushroom", "bell pepper", "tomato", "leek"],
    flavours: ["plain"],
    suffix: "jacket potatoes",
  },
  {
    id: "fritter",
    label: "Vegetable fritters",
    category: "Lunch",
    prep: 10,
    cook: 16,
    bases: ["flour"],
    proteins: ["egg"],
    vegetables: ["zucchini", "carrot", "potato", "sweet potato"],
    flavours: ["plain"],
    suffix: "fritters",
  },
  {
    id: "grain-bowl",
    label: "Grain bowls",
    category: "Lunch",
    prep: 10,
    cook: 10,
    bases: ["couscous"],
    proteins: ["chickpea", "white bean", "feta", "cheese"],
    vegetables: cold,
    flavours: ["lemon"],
    suffix: "couscous bowl",
  },
  {
    id: "casserole",
    label: "Oven casseroles",
    category: "Family dinner",
    prep: 15,
    cook: 35,
    bases: ["pasta"],
    proteins,
    vegetables: warm,
    flavours: ["tomato"],
    suffix: "pasta bake",
  },
  {
    id: "noodles",
    label: "Noodle dishes",
    category: "Noodles",
    prep: 10,
    cook: 15,
    bases: ["noodle"],
    proteins,
    vegetables: warm.filter((x) => x !== "sweet potato"),
    flavours: ["soy"],
    suffix: "noodles",
  },
  {
    id: "breakfast",
    label: "Breakfast combinations",
    category: "Breakfast",
    prep: 5,
    cook: 8,
    bases: ["oats"],
    proteins: ["milk", "yogurt"],
    vegetables: ["banana", "apple", "pear", "berry"],
    flavours: ["plain"],
    suffix: "breakfast oats",
  },
];
export function ingredient(name: string, scale = 1): Ingredient {
  const p = profiles[name];
  if (!p) throw Error(`Unsupported ingredient ${name}`);
  const quantity = p.quantity * scale;
  return {
    name,
    quantity,
    unit: p.unit,
    amount: `${quantity} ${p.unit}`,
    form: p.form,
  };
}
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export function compose(
  t: Template,
  base: string,
  protein: string,
  veg: string[],
  flavour: string,
  source: Recipe["source"] = "adaptive",
): Recipe {
  if (
    !t.bases.includes(base) ||
    !t.proteins.includes(protein) ||
    veg.length < 1 ||
    veg.length > 2 ||
    veg.some((v) => !t.vegetables.includes(v)) ||
    !t.flavours.includes(flavour)
  )
    throw Error("Unsupported cooking combination");
  const names = [base, protein, ...veg, "oil"];
  if (flavour === "soy") names.push("soy sauce");
  if (flavour === "tomato") names.push("canned tomato");
  if (flavour === "lemon") names.push("lemon");
  if (flavour === "paprika") names.push("ground paprika");
  if (t.id === "soup") names.push("vegetable stock");
  if (t.id === "casserole") names.push("cheese");
  if (t.id === "fritter") names.push("egg");
  if (t.id === "breakfast") {
    names.splice(names.indexOf("oil"), 1);
    names.push("water");
  }
  const ingredients = [...new Set(names)].map((n) => ingredient(n));
  if (t.id === "breakfast") {
    const water = ingredients.find((i) => i.name === "water")!;
    water.quantity = protein === "milk" ? 200 : 350;
    water.amount = `${water.quantity} ml`;
  }
  const pp = profiles[protein];
  const vp = veg.map((v) => profiles[v]);
  const steps: string[] = [];
  if (t.id === "baked-potato")
    steps.push(
      "Heat oven to 200°C / 390°F. Scrub and prick medium potatoes. Bake whole on a tray for 50–65 minutes, until a knife slides into the centre easily. While they bake, prepare the filling in the following steps. Larger potatoes take longer.",
    );
  else if (["pasta", "rice", "noodle", "couscous"].includes(base))
    steps.push(
      profiles[base].prep +
        (base === "rice"
          ? " Serve rice freshly cooked; this recipe does not require leftover rice."
          : ""),
    );
  else if (t.id === "skillet")
    steps.push(
      "Scrub potatoes and dice to 1 cm. Cover with water, simmer 10–12 minutes until just tender, then drain.",
    );
  else if (t.id === "roast")
    steps.push(
      "Heat oven to 210°C / 410°F. Scrub potatoes and dice to 1 cm. Use a large tray so the vegetables sit in one layer.",
    );
  else if (t.id === "soup")
    steps.push(
      "Scrub potatoes and dice to 1 cm. Set out a deep saucepan and a separate frying pan for any raw protein.",
    );
  else if (t.id === "fritter")
    steps.push(
      `Grate ${veg.join(" and ")} and squeeze out excess liquid in a clean towel. Beat the eggs, then mix with flour and grated vegetables into a thick batter.`,
    );
  else if (base === "egg") steps.push(profiles.egg.prep);
  else if (base === "bread")
    steps.push("Toast bread if you like. Set out two clean plates.");
  else if (base === "lettuce") steps.push(profiles.lettuce.prep);
  else if (base === "tortilla") steps.push(profiles.tortilla.prep);
  else if (base === "oats")
    steps.push(
      "Put oats and water in a saucepan. If using milk, add it now; reserve yogurt for serving. Bring to a gentle simmer.",
    );
  if (t.id !== "fritter") steps.push(vp.map((p) => p.prep).join(" "));
  const coldMeal = ["salad", "sandwich", "grain-bowl"].includes(t.id);
  if (pp.method === "chicken")
    steps.push(
      "Using a separate board, dice thawed chicken to 2 cm; do not wash it. Heat half the oil over medium-high heat and cook chicken for about 8–12 minutes, turning. Check the thickest pieces reach 74°C / 165°F with a food thermometer. Transfer to a clean plate; wash hands, board and utensils before touching ready-to-eat food.",
    );
  if (pp.method === "fish")
    steps.push(
      `Check ${protein} for bones. Heat half the oil in a nonstick pan. Cook the 3 cm pieces gently for about 6–10 minutes, turning carefully, until the centre reaches 63°C / 145°F and the flesh is opaque and flakes easily. Transfer to a clean plate.`,
    );
  if (pp.method === "tofu")
    steps.push(
      "Drain and pat firm tofu dry. Cut to 2 cm and pan-fry in half the oil for 6–8 minutes, turning until golden.",
    );
  if (pp.method === "bean")
    steps.push(
      pp.prep +
        (coldMeal
          ? " These recipes require ready-to-eat cooked beans, never dry beans."
          : " Keep ready to add once the vegetables are tender."),
    );
  if (pp.group === "dairy") steps.push(pp.prep);
  if (t.id === "roast")
    steps.push(
      `Toss potato and ${veg.join(" and ")} with the oil${flavour === "paprika" ? " and paprika" : ""}. Roast 25–30 minutes, turning halfway, until the potatoes and firm vegetables are tender. Add cooked beans or tofu for the last 10 minutes; add feta after roasting. Check all hot components are piping hot.`,
    );
  else if (t.id === "soup")
    steps.push(
      `Heat the oil in the saucepan. Add potato and ${veg.filter((v) => profiles[v].method !== "leaf").join(" and ") || "the prepared potato"}; stir for 3 minutes. Add stock${flavour === "tomato" ? " and canned tomatoes" : ""}. Simmer 18–22 minutes until potatoes and firm vegetables are tender. Add leafy greens, cooked protein and beans for the final 3–5 minutes; heat through thoroughly.`,
    );
  else if (t.id === "fritter")
    steps.push(
      "Heat the oil over medium heat. Drop small spoonfuls of batter into the pan and flatten to no more than 1 cm thick. Cook 6–8 minutes per side, until golden, the centres are set and the vegetables are tender. Egg-containing centres must reach 71°C / 160°F. Do not taste raw batter.",
    );
  else if (t.id === "breakfast")
    steps.push(
      "Simmer oats gently for 5–8 minutes, stirring, adding a little water if needed. Add diced apple or pear early to soften; fresh banana and fresh berries can go on top. Frozen berries must be cooked separately according to their packet before adding.",
    );
  else if (coldMeal)
    steps.push(
      `${base === "couscous" ? "Fluff the cooked couscous and divide between bowls. " : ""}Combine the washed vegetables with the ready-to-eat beans or pasteurised cheese. ${t.id === "sandwich" ? "Mash beans with a little oil if using them, then layer the filling between bread slices." : "Divide between two plates or bowls."}`,
    );
  else {
    const firm = vp.filter((p) => p.method === "root" || p.method === "firm");
    const soft = vp.filter((p) => p.method === "soft");
    const leaf = vp.filter((p) => p.method === "leaf");
    steps.push(
      `Heat ${pp.method === "chicken" || pp.method === "fish" || pp.method === "tofu" ? "the remaining" : "the"} oil in a wide pan over medium heat. ${firm.length ? `Cook ${firm.map((p) => p.name).join(" and ")} for 8–12 minutes with a splash of water, covered briefly, until tender. ` : ""}${soft.length ? `Add ${soft.map((p) => p.name).join(" and ")} and cook 4–6 minutes. ` : ""}${leaf.length ? `Stir in ${leaf.map((p) => p.name).join(" and ")} for 1–2 minutes until wilted. ` : ""}Check firm vegetables are tender before continuing.`,
    );
    if (["omelette", "scramble"].includes(t.id))
      steps.push(
        t.id === "omelette"
          ? "Reduce to medium-low heat and pour in beaten eggs. Scatter over the cheese. Cook gently until fully set, folding only when the base holds. Check the centre reaches 71°C / 160°F; no runny egg should remain."
          : "Add beaten eggs and cheese to the pan over medium-low heat. Stir gently until the eggs are fully set and reach 71°C / 160°F. Serve immediately.",
      );
    else if (t.id === "baked-potato")
      steps.push(
        "Split the tender baked potatoes. Spoon the hot vegetable and bean/tofu filling inside, or scatter on the cheese. Return to the oven for 5 minutes if melting cheese.",
      );
    else
      steps.push(
        `${flavour === "tomato" ? "Add canned tomatoes and simmer 8 minutes. " : ""}${flavour === "soy" ? "Add soy sauce and a splash of water; stir for 1 minute. " : ""}${t.id === "casserole" ? "Mix cooked pasta, vegetables, sauce and cooked protein in an oven dish. Top with cheese and bake at 200°C / 390°F for 15–20 minutes until the centre reaches 74°C / 165°F." : `Combine ${base === "tortilla" ? "the filling" : base === "potato" ? "the tender potatoes" : "the cooked " + base} with cooked protein and vegetables; heat until piping hot throughout. ${t.id === "fried-rice" ? "Stir-fry the freshly cooked rice for 2–3 minutes; if using egg, scramble it fully to 71°C before mixing with the rice." : ""}${base === "tortilla" ? "Divide the hot filling between the warmed tortillas and fold closed." : ""}`}`,
      );
  }
  steps.push(
    `${flavour === "lemon" ? "Finish with lemon juice. " : ""}${t.id === "breakfast" && protein === "yogurt" ? "Spoon yogurt over the cooked oats. " : ""}Serve ${coldMeal ? "promptly" : "immediately"}. Taste before adding salt; adjust seasoning to your household’s needs.`,
  );
  const allergies = [
    ...new Set(ingredients.flatMap((i) => profiles[i.name].allergens ?? [])),
  ];
  const animal = ingredients.some((i) => profiles[i.name].animal);
  const meat = ingredients.some((i) =>
    ["chicken", "fish"].includes(profiles[i.name].method),
  );
  const tags = meat ? [] : animal ? ["vegetarian"] : ["vegan", "vegetarian"];
  if (!allergies.some((a) => /wheat|oats|check label/.test(a)))
    tags.push("gluten-free");
  const title = titleCase([protein, ...veg].join(" & ")) + " " + t.suffix;
  const id = [
    source === "adaptive" ? "adapt" : "collection",
    t.id,
    base,
    protein,
    ...[...veg].sort(),
    flavour,
  ]
    .join("-")
    .replace(/\s/g, "_");
  const proteinMinutes =
    pp.method === "chicken"
      ? 12
      : pp.method === "fish"
        ? 10
        : pp.method === "tofu"
          ? 8
          : 0;
  const vegMinutes =
    (vp.some((p) => p.method === "root" || p.method === "firm") ? 12 : 0) +
    (vp.some((p) => p.method === "soft") ? 6 : 0) +
    (vp.some((p) => p.method === "leaf") ? 2 : 0);
  let cookTime = Math.max(
    t.cook,
    proteinMinutes + vegMinutes + (flavour === "tomato" ? 8 : 0) + 3,
  );
  if (["salad", "sandwich"].includes(t.id)) cookTime = 0;
  if (t.id === "grain-bowl") cookTime = 5;
  if (t.id === "breakfast") cookTime = 8;
  if (t.id === "roast") cookTime = 30 + proteinMinutes;
  if (t.id === "soup") cookTime = 30 + proteinMinutes;
  if (t.id === "baked-potato") cookTime = 70;
  if (t.id === "fritter") cookTime = 16;
  if (["omelette", "scramble"].includes(t.id)) cookTime = vegMinutes + 8;
  if (t.id === "casserole") cookTime = proteinMinutes + vegMinutes + 8 + 20;
  return {
    id,
    name: title,
    description: `${flavour === "soy" ? "Savoury soy" : flavour === "lemon" ? "Bright lemon" : flavour === "tomato" ? "Rich tomato" : flavour === "paprika" ? "Warm paprika" : "Simple everyday"} ${t.suffix}, built around ${veg.join(" and ")}.`,
    category: t.category,
    prepTime: t.prep,
    cookTime,
    time: t.prep + cookTime,
    difficulty: "Easy",
    servings: 2,
    ingredients,
    steps,
    tags,
    allergens: allergies,
    substitutions: [
      `Vegetable alternatives for this method: ${t.vegetables
        .filter((v) => !veg.includes(v))
        .slice(0, 4)
        .join(", ")}. Recalculate the recipe after changing ingredients.`,
      `Protein alternatives for this method: ${t.proteins
        .filter((p) => p !== protein)
        .slice(0, 3)
        .join(
          ", ",
        )}. Follow the replacement’s preparation and cooking instructions; allergens and dietary tags may change.`,
    ],
    safety: [
      "Dates are not a freshness test. Exclude past use-by food; check best-before, storage history and product labels.",
      "Wash hands and produce; keep raw meat and fish separate from ready-to-eat food. Use a food thermometer where specified.",
      "Refrigerate leftovers promptly within 2 hours. For rice, cool within 1 hour, refrigerate, use within 24 hours and reheat only once to piping hot. Reheat other leftovers to 74°C / 165°F.",
      ...(ingredients.some((i) => i.form)
        ? [
            "Beans and lentils here must be canned or fully cooked. Never substitute raw dried beans without a separate safe cooking process.",
          ]
        : []),
    ],
    color: ["sage", "peach", "gold", "lavender"][templates.indexOf(t) % 4],
    source,
    template: t.id,
  };
}
