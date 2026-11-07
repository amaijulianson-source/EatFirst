import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { emptyData, type Shopping, validateBackup } from "../src/core";
import {
  normalizeProduct,
  parseQuantity,
  makeDraft,
  draftFromShopping,
  saveDrafts,
  learnPatterns,
  sharedPatterns,
  validatePatterns,
} from "../src/entry/model";
import {
  readPatterns,
  savePatterns,
  storeDraft,
  readDraft,
  clearDraft,
  validateDraft,
} from "../src/entry/storage";
import { db } from "../src/db";
import { recommendations } from "../src/cooking/engine";
const day = "2026-11-06";
const item = (
  name: string,
  quantity = "1 pieces",
  checked = true,
): Shopping => ({ id: crypto.randomUUID(), name, quantity, checked });
describe("grocery names and quantities", () => {
  it.each([
    ["AH halfvolle melk 1L", "Milk (semi-skimmed)", "Fridge"],
    ["spaghetti 500g", "Pasta", "Pantry"],
    ["kipfilet 350g", "Chicken breast", "Fridge"],
    ["Eggs 12 pieces", "Eggs", "Fridge"],
    ["diepvries broccoli 500g", "Broccoli", "Freezer"],
    ["sojamelk 1L", "Soy drink", "Fridge"],
    ["havermelk 1L", "Oat drink", "Fridge"],
    ["Champignons 250g", "Mushrooms", "Fridge"],
    ["Jumbo halfvolle melk1L", "Milk (semi-skimmed)", "Fridge"],
  ])("normalizes %s while retaining useful details", (raw, name, location) => {
    const n = normalizeProduct(raw);
    expect(n.name).toBe(name);
    expect(n.location).toBe(location);
  });
  it.each([
    ["1L", 1, "litre"],
    ["2 x 500g", 1000, "g"],
    ["1,5 kg", 1.5, "kg"],
    ["6×330ml", 1980, "ml"],
    ["12 eieren", 12, "pieces"],
    ["50 cl", 500, "ml"],
    ["2dl", 200, "ml"],
  ])("parses %s without inventing weights", (text, quantity, unit) =>
    expect(parseQuantity(text)).toMatchObject({
      quantity,
      unit,
      explicit: true,
    }),
  );
  it.each([
    ["Peanut butter 350g", "Peanut butter"],
    ["Soy yogurt 500g", "Soy yogurt"],
    ["Coconut milk 400ml", "Coconut milk"],
    ["Milk chocolate 100g", "Milk chocolate"],
    ["Chicken stock 500ml", "Chicken stock"],
    ["Vegan cheese 200g", "Vegan cheese"],
    ["Cooked chicken 250g", "Cooked chicken"],
  ])("preserves food identity for %s", (raw, name) =>
    expect(normalizeProduct(raw).name).toBe(name),
  );
  it("explicit frozen packaging overrides a remembered pantry preference", () => {
    const pattern = learnPatterns(
      [],
      [{ ...makeDraft("Bread"), location: "Pantry" }],
      "2026-11-06",
    );
    expect(makeDraft("Frozen bread", "manual", pattern).location).toBe(
      "Freezer",
    );
  });
  it("a saved storage preference is retained when no new label overrides it", () => {
    const pattern = learnPatterns(
      [],
      [{ ...makeDraft("Bread"), location: "Freezer" }],
      "2026-11-06",
    );
    expect(makeDraft("Bread", "manual", pattern).location).toBe("Freezer");
  });
  it("unknown quantities stay explicit review defaults", () => {
    expect(parseQuantity("a bag of carrots").explicit).toBe(false);
    expect(makeDraft("unknown groceries").review.join(" ")).toMatch(
      /not recognized/,
    );
    expect(makeDraft("Milk").expiry).toBe("");
  });
  it("keeps milk variants separate while remaining compatible with recipes", () => {
    const d = makeDraft("AH halfvolle melk 1L");
    const data = saveDrafts(emptyData(), [d], emptyData(), false, day).data;
    expect(
      recommendations(data, day).some((r) =>
        r.checks.some(
          (c) => c.ingredient.name === "milk" && c.status === "available",
        ),
      ),
    ).toBe(true);
  });
});
describe("product memory", () => {
  it("can derive scoped household suggestions without new shared fields", () => {
    const d = makeDraft("Milk 1L");
    const data = saveDrafts(emptyData(), [d], emptyData(), false, day).data;
    expect(sharedPatterns(data)[0]).toMatchObject({
      name: "Milk",
      unit: "litre",
    });
    expect(data.version).toBe(1);
  });
});
describe("atomic shopping trip and conservative merging", () => {
  it("transfers selected purchased items without retyping and leaves the rest", () => {
    const d = emptyData();
    d.shopping = [
      item("Milk", "1 litre"),
      item("Spaghetti", "500 g"),
      item("Bread", "1 loaf", false),
    ];
    const rows = d.shopping
      .filter((s) => s.checked)
      .map((s) => draftFromShopping(s));
    const r = saveDrafts(d, rows, d, false, day).data;
    expect(r.foods.map((f) => [f.name, f.quantity, f.unit])).toEqual([
      ["Milk", 1, "litre"],
      ["Pasta", 500, "g"],
    ]);
    expect(r.shopping).toEqual([d.shopping[2]]);
    expect(r.foods.every((f) => f.expiry === "")).toBe(true);
    expect(validateBackup(r)).toEqual(r);
    expect(d.foods).toEqual([]);
  });
  it("unselected rows stay on the shopping list", () => {
    const d = emptyData();
    d.shopping = [item("Milk"), item("Eggs")];
    const rows = d.shopping.map((s) => draftFromShopping(s));
    rows[1].included = false;
    const r = saveDrafts(d, rows, d);
    expect(r.data.shopping.map((s) => s.name)).toEqual(["Eggs"]);
  });
  it("rejects stale or already transferred shopping rows and duplicate IDs", () => {
    const d = emptyData();
    d.shopping = [item("Milk")];
    const row = draftFromShopping(d.shopping[0]);
    expect(() => saveDrafts({ ...d, shopping: [] }, [row], d)).toThrow(
      /changed|already/,
    );
    expect(() =>
      saveDrafts(d, [row, { ...row, id: crypto.randomUUID() }], d),
    ).toThrow(/twice/);
  });
  it("merges exact batches only after an explicit merge choice", () => {
    const d = makeDraft("Milk 1L");
    d.notes = "";
    let current = saveDrafts(emptyData(), [d], emptyData(), false, day).data;
    expect(
      saveDrafts(current, [d], current, false, day).data.foods,
    ).toHaveLength(2);
    const r = saveDrafts(current, [d], current, true, day);
    expect(r.data.foods).toHaveLength(1);
    expect(r.data.foods[0].quantity).toBe(2);
    const other = { ...d, expiry: "2026-11-12" };
    expect(
      saveDrafts(current, [other], current, true, day).data.foods,
    ).toHaveLength(2);
    current = {
      ...current,
      foods: current.foods.map((f) => ({ ...f, value: 2 })),
    };
    expect(
      saveDrafts(current, [d], current, true, day).data.foods,
    ).toHaveLength(2);
  });
  it("rejects invalid quantities and dates before making any changes", () => {
    const d = makeDraft("Milk");
    expect(() =>
      saveDrafts(emptyData(), [{ ...d, quantity: 0 }], emptyData()),
    ).toThrow();
    expect(() =>
      saveDrafts(emptyData(), [{ ...d, expiry: "2026-02-31" }], emptyData()),
    ).toThrow();
    expect(() =>
      saveDrafts(emptyData(), [{ ...d, name: "" }], emptyData()),
    ).toThrow();
  });
});
describe("batch date assignment and scoped local state", () => {
  beforeEach(async () => {
    await db.caches.clear();
  });
  it("isolates patterns by account and household", async () => {
    const p = learnPatterns([], [makeDraft("Milk")], day);
    await savePatterns("entry:userA:houseA", p);
    expect(await readPatterns("entry:userA:houseA")).toEqual(p);
    expect(await readPatterns("entry:userB:houseA")).toEqual([]);
    expect(await readPatterns("entry:userA:houseB")).toEqual([]);
    expect(() => validatePatterns([{ name: "bad" }])).toThrow();
  });
  it("persists unfinished reviews and their original concurrency baseline", async () => {
    const baseline = emptyData();
    baseline.shopping = [item("Milk")];
    const rows = baseline.shopping.map((s) => draftFromShopping(s));
    await storeDraft("entry:user:house:shopping", { rows, baseline });
    const saved = await readDraft("entry:user:house:shopping");
    expect(saved).toEqual({ rows, baseline });
    expect(await readDraft("entry:other:house:shopping")).toBeNull();
    expect(() => validateDraft({ rows: [{}], baseline })).toThrow();
    await clearDraft("entry:user:house:shopping");
    expect(await readDraft("entry:user:house:shopping")).toBeNull();
  });
});
