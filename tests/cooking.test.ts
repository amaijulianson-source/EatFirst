import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { emptyData, type Food, type Data, validateBackup } from "../src/core";
import {
  recipes,
  templates,
  recommendations,
  generate,
  evaluate,
  checkIngredient,
  measure,
  scaled,
  recipeShopping,
  confirmCooking,
  emptyPersonal,
} from "../src/cooking/engine";
import { ingredientKey } from "../src/cooking/ingredients";
import { compose, ingredient } from "../src/cooking/templates";
import {
  readPersonal,
  changePersonal,
  validatePersonal,
} from "../src/cooking/personal";
import { db } from "../src/db";
const day = "2026-11-06";
const food = (
  name: string,
  quantity = 500,
  unit = "g",
  extra: Partial<Food> = {},
): Food => ({
  id: crypto.randomUUID(),
  name,
  quantity,
  unit,
  category: "Produce",
  location: "Fridge",
  added: day,
  expiry: "2026-11-09",
  dateType: "use-by",
  notes: "",
  ...extra,
});
const kitchen = (foods: Food[]): Data => ({ ...emptyData(), foods });
const pantry = kitchen([
  food("kipfilet", 300),
  food("broccoli", 300),
  food("wortels", 250),
  food("rijst", 500),
  food("sojasaus", 100, "ml"),
]);
describe("reviewed recipe collection", () => {
  it("has 150–300 unique complete structured recipes and 18 distinct methods", () => {
    expect(recipes.length).toBeGreaterThanOrEqual(150);
    expect(recipes.length).toBeLessThanOrEqual(300);
    expect(templates).toHaveLength(18);
    expect(new Set(recipes.map((r) => r.id)).size).toBe(recipes.length);
    expect(new Set(recipes.map((r) => r.name)).size).toBe(recipes.length);
    for (const r of recipes) {
      expect(r.steps.length, r.name).toBeGreaterThanOrEqual(3);
      expect(r.time).toBe(r.prepTime + r.cookTime);
      expect(r.servings).toBe(2);
      expect(r.category).toBeTruthy();
      expect(r.description.length).toBeGreaterThan(15);
      expect(r.safety.length).toBeGreaterThan(0);
      expect(r.substitutions.length).toBeGreaterThan(0);
      for (const i of r.ingredients) {
        expect(i.quantity, r.name).toBeGreaterThan(0);
        expect(Number.isFinite(i.quantity)).toBe(true);
        expect(i.unit).toBeTruthy();
      }
    }
  });
  it.each(templates.map((t) => [t.id, t]))(
    "%s validates role compatibility",
    (_id, t) => {
      expect(() =>
        compose(t, "unknown", t.proteins[0], [t.vegetables[0]], t.flavours[0]),
      ).toThrow();
      expect(() =>
        compose(
          t,
          t.bases[0],
          "raw kidney beans",
          [t.vegetables[0]],
          t.flavours[0],
        ),
      ).toThrow();
    },
  );
  it("retains original stable identifiers", () => {
    expect(recipes.find((r) => r.id === "1")?.name).toBe("Garden omelette");
    expect(recipes.find((r) => r.id === "7")?.name).toBe("Tomato toast");
  });
});
describe("ingredient recognition and quantities", () => {
  it.each([
    ["kipfilet", "chicken"],
    ["tomaten", "tomato"],
    ["eieren", "egg"],
    ["spinazie", "spinach"],
    ["champignons", "mushroom"],
    ["sojasaus", "soy sauce"],
    ["aardappelen", "potato"],
    ["kaas", "cheese"],
    ["wortelen", "carrot"],
    ["courgette", "zucchini"],
    ["peppers", "bell pepper"],
  ])("recognizes %s without guessing", (a, b) =>
    expect(ingredientKey(a)).toBe(b),
  );
  it("does not confuse raw and cooked rice, spice and pepper, or fish species", () => {
    expect(ingredientKey("cooked rice")).not.toBe(ingredientKey("rice"));
    expect(ingredientKey("ground paprika")).not.toBe(ingredientKey("paprika"));
    expect(ingredientKey("cod")).not.toBe("salmon");
    expect(ingredientKey("eggplant")).not.toBe("egg");
  });
  it("converts compatible quantities only", () => {
    expect(measure(0.5, "kg")).toEqual({ quantity: 500, unit: "g" });
    expect(measure(1, "litre")).toEqual({ quantity: 1000, unit: "ml" });
    expect(measure(1, "tbsp")).toEqual({ quantity: 15, unit: "ml" });
    expect(measure(1, "pack").unit).toBe("pack");
  });
  it("finds exact shortages and never calls insufficient stock ready", () => {
    const r = recipes.find(
      (r) =>
        r.template === "rice-bowl" &&
        r.ingredients.some((i) => i.name === "chicken"),
    )!;
    const d = kitchen([food("chicken", 100)]);
    const m = evaluate(r, d, day);
    expect(m.checks.find((c) => c.ingredient.name === "chicken")?.status).toBe(
      "short",
    );
    expect(m.missing.find((c) => c.name === "chicken")?.quantity).toBe(150);
    expect(m.state).not.toBe("Ready to cook");
  });
  it("requires verification for bags, packs, pieces versus grams", () => {
    const m = checkIngredient(
      ingredient("chicken"),
      kitchen([food("chicken", 1, "pack")]),
      day,
    );
    expect(m.status).toBe("verify");
    expect(m.allocations).toEqual([]);
  });
  it("sums compatible packages and allocates urgent food first", () => {
    const late = food("carrot", 100, "g", { expiry: "2026-11-12" }),
      soon = food("wortel", 100, "g", { expiry: day });
    const m = checkIngredient(ingredient("carrot"), kitchen([late, soon]), day);
    expect(m.status).toBe("available");
    expect(m.allocations).toEqual([
      { id: soon.id, amount: 100 },
      { id: late.id, amount: 50 },
    ]);
  });
  it("scales servings without rounding away shortfalls", () => {
    const i = ingredient("rice");
    expect(scaled(i, 4).quantity).toBe(300);
    expect(scaled(i, 1).quantity).toBe(75);
    const r = recipes.find((r) => r.template === "rice-bowl")!;
    expect(
      evaluate(r, pantry, day, 4).ingredients.find((i) => i.name === "chicken")
        ?.quantity,
    ).toBe(500);
  });
  it("distinguishes unknown quantity and known shortage even with partial matches", () => {
    expect(
      checkIngredient(
        ingredient("carrot"),
        kitchen([food("carrot", 20), food("carrot", 1, "bag")]),
        day,
      ).status,
    ).toBe("verify");
  });
});
describe("adaptive composition and safety", () => {
  it("creates rice bowls, fried rice and stir-fry from Dutch groceries", () => {
    const all = generate(pantry, day);
    for (const t of ["rice-bowl", "fried-rice", "stir-fry"])
      expect(
        all.some(
          (r) =>
            r.template === t &&
            r.name.toLowerCase().includes("chicken") &&
            r.ingredients.some((i) => i.name === "broccoli"),
        ),
      ).toBe(true);
    const m = recommendations(pantry, day);
    expect(
      m.some((r) => r.source === "adaptive" && r.state === "Ready to cook"),
    ).toBe(true);
  });
  it("adapts to an entirely different inventory and remains deterministic", () => {
    const d = kitchen([
      food("potato", 1000),
      food("spinach"),
      food("mushroom"),
      food("cheese", 200),
    ]);
    const a = generate(d, day);
    expect(a.some((r) => r.template === "baked-potato")).toBe(true);
    expect(a.some((r) => r.ingredients.some((i) => i.name === "chicken"))).toBe(
      false,
    );
    expect(generate(d, day)).toEqual(a);
    expect(a.map((r) => r.id)).not.toEqual(
      generate(pantry, day).map((r) => r.id),
    );
  });
  it("empty and unknown inventory generate no arbitrary combinations", () => {
    expect(generate(emptyData(), day)).toEqual([]);
    expect(generate(kitchen([food("dragon fruit sauce")]), day)).toEqual([]);
  });
  it.each(["use-by", "best-before"] as const)(
    "excludes past %s supplies from generation, matching and deductions",
    (dateType) => {
      const expired = food("chicken", 1000, "g", {
        expiry: "2026-11-05",
        dateType,
      });
      const d = kitchen([
        expired,
        ...pantry.foods.filter((f) => ingredientKey(f.name) !== "chicken"),
      ]);
      expect(
        generate(d, day).some((r) =>
          r.ingredients.some((i) => i.name === "chicken"),
        ),
      ).toBe(false);
      expect(checkIngredient(ingredient("chicken"), d, day).status).toBe(
        "missing",
      );
      expect(() =>
        confirmCooking(
          d,
          recipes.find((r) => r.ingredients.some((i) => i.name === "chicken"))!,
          { [expired.id]: 10 },
          day,
        ),
      ).toThrow();
    },
  );
  it("never lets pantry assumptions mask expired inventory or assume raw chicken", () => {
    const d = kitchen([food("rice", 500, "g", { expiry: "2026-11-05" })]);
    d.settings.staples = ["rice", "chicken"];
    expect(checkIngredient(ingredient("rice"), d, day).status).toBe("missing");
    expect(checkIngredient(ingredient("chicken"), d, day).status).toBe(
      "missing",
    );
  });
  it("requires verification of frozen ingredients and ready-to-eat bean forms", () => {
    expect(
      checkIngredient(
        ingredient("chicken"),
        kitchen([food("chicken", 500, "g", { location: "Freezer" })]),
        day,
      ).status,
    ).toBe("verify");
    expect(
      checkIngredient(
        ingredient("kidney bean"),
        kitchen([food("kidney bean")]),
        day,
      ).status,
    ).toBe("verify");
    expect(
      checkIngredient(
        ingredient("kidney bean"),
        kitchen([food("canned kidney beans")]),
        day,
      ).status,
    ).toBe("available");
  });
  it("keeps raw meat out of cold templates and supplies explicit temperature controls", () => {
    for (const t of templates.filter((t) =>
      ["salad", "sandwich", "grain-bowl"].includes(t.id),
    ))
      expect(t.proteins).not.toContain("chicken");
    for (const r of recipes.filter(
      (r) =>
        r.source === "curated" &&
        r.template &&
        r.ingredients.some((i) => i.name === "chicken"),
    ))
      expect(r.steps.join(" "), r.name).toMatch(/74°C/);
    for (const r of recipes.filter((r) => r.template === "fritter"))
      expect(r.steps.join(" ")).toMatch(/71°C/);
  });
  it("prioritizes joint urgency and safe same-date foods", () => {
    const r = recipes.find((r) => r.id === "1")!,
      d = kitchen([
        food("egg", 10, "pieces"),
        food("spinach", 10, "handful"),
        food("cheese", 200),
      ]);
    d.foods = d.foods.map((f) => ({ ...f, expiry: "2099-01-01" }));
    const later = evaluate(r, d, day);
    const urgent = evaluate(
      r,
      { ...d, foods: d.foods.map((f) => ({ ...f, expiry: day })) },
      day,
    );
    expect(urgent.urgent).toBeGreaterThan(later.urgent);
    expect(urgent.score).toBeGreaterThan(later.score);
  });
  it("honours vegetarian, vegan, exclusions and known allergens", () => {
    const d = structuredClone(pantry);
    d.settings.diet = ["vegan"];
    expect(
      recommendations(d, day).every(
        (r) =>
          r.tags.includes("vegan") &&
          !r.ingredients.some((i) => i.name === "chicken"),
      ),
    ).toBe(true);
    const p = {
      ...emptyPersonal(),
      exclusions: ["champignons"],
      allergens: ["milk"],
    };
    expect(
      recommendations(d, day, p).every(
        (r) =>
          !r.ingredients.some((i) => i.name === "mushroom") &&
          !r.allergens.some((a) => a.includes("milk")),
      ),
    ).toBe(true);
  });
  it("reduces repetition while retaining deterministic recommendation order", () => {
    const top = recommendations(pantry, day)[0];
    const a = recommendations(pantry, day, {
      ...emptyPersonal(),
      history: [{ recipe: top, date: day, servings: 2 }],
    });
    expect(a.find((r) => r.id === top.id)!.score).toBe(top.score - 8);
  });
  it("handles a large inventory without mutating it", () => {
    const d = kitchen(
      Array.from({ length: 1000 }, (_, i) =>
        food(
          ["carrot", "broccoli", "rice", "chicken", "soy sauce"][i % 5],
          500,
          i % 5 === 4 ? "ml" : "g",
        ),
      ),
    );
    const copy = JSON.stringify(d);
    const start = performance.now();
    expect(recommendations(d, day).length).toBeGreaterThan(150);
    expect(performance.now() - start).toBeLessThan(5000);
    expect(JSON.stringify(d)).toBe(copy);
  });
});
describe("shopping and confirmed cooking", () => {
  it("adds shortfalls, deduplicates repeated taps and merges compatible list units", () => {
    const r = recipes.find(
      (r) =>
        r.template === "rice-bowl" &&
        r.ingredients.some((i) => i.name === "chicken"),
    )!;
    let d = kitchen([food("chicken", 100)]);
    const m = evaluate(r, d, day);
    d = recipeShopping(d, m);
    const same = recipeShopping(d, m);
    expect(same.shopping.map((i) => [i.name, i.quantity])).toEqual(
      d.shopping.map((i) => [i.name, i.quantity]),
    );
    expect(same.shopping.find((i) => i.name === "chicken")?.quantity).toBe(
      "150 g",
    );
    d.shopping.find((i) => i.name === "chicken")!.quantity = ".2 kg";
    const n = recipeShopping(d, m);
    expect(n.shopping.filter((i) => i.name === "chicken")).toHaveLength(1);
    expect(n.shopping.find((i) => i.name === "chicken")?.quantity).toBe(
      "200 g",
    );
    expect(validateBackup(n)).toEqual(n);
  });
  it("reopens a checked item without duplicating it", () => {
    const r = recipes[0],
      m = evaluate(r, emptyData(), day);
    let d = recipeShopping(emptyData(), m);
    d.shopping[0].checked = true;
    d = recipeShopping(d, m);
    expect(
      d.shopping.filter((s) => s.name === d.shopping[0].name),
    ).toHaveLength(1);
    expect(d.shopping[0].checked).toBe(false);
  });
  it("never deducts anything until explicit nonzero quantities are confirmed", () => {
    const r = recipes.find((r) =>
      r.ingredients.some((i) => i.name === "chicken"),
    )!;
    const d = structuredClone(pantry),
      f = d.foods[0];
    expect(confirmCooking(d, r, {}, day)).toBe(d);
    const next = confirmCooking(d, r, { [f.id]: 50 }, day);
    expect(next.foods.find((x) => x.id === f.id)?.quantity).toBe(250);
    expect(next.events.at(-1)?.action).toBe("used");
    expect(d.events).toHaveLength(0);
    expect(() => confirmCooking(d, r, { [f.id]: 9999 }, day)).toThrow();
    expect(() => confirmCooking(d, r, { missing: 2 }, day)).toThrow();
  });
});
describe("private recipe memories", () => {
  beforeEach(async () => {
    await db.caches.clear();
  });
  it("persists favorites, exclusions and history, isolated by user and household", async () => {
    const key = "recipes:userA:houseA";
    await changePersonal(key, (p) => ({
      ...p,
      favorites: [recipes[0]],
      history: [
        { recipe: recipes[0], date: new Date().toISOString(), servings: 2 },
      ],
      exclusions: ["mushroom"],
    }));
    expect((await readPersonal(key)).favorites[0].id).toBe(recipes[0].id);
    expect((await readPersonal("recipes:userB:houseA")).favorites).toEqual([]);
    expect((await readPersonal("recipes:userA:houseB")).history).toEqual([]);
  });
  it("round-trips valid recipe memories and rejects invalid imports", () => {
    const p = { ...emptyPersonal(), favorites: [recipes[0]] };
    expect(validatePersonal(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(() =>
      validatePersonal({
        favorites: [{ id: "bad" }],
        history: [],
        exclusions: [],
      }),
    ).toThrow();
    expect(() => validatePersonal({ ...p, allergens: "milk" })).toThrow();
  });
});
