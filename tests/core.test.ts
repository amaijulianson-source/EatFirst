import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  emptyData,
  localDate,
  dayNumber,
  status,
  eligible,
  consume,
  addShopping,
  validateBackup,
  wasteStats,
  normalize,
  validDate,
  type Food,
} from "../src/core";
import { matchRecipes, recipes } from "../src/recipes";
import { db, saveData, readData } from "../src/db";
const food = (over: Partial<Food> = {}): Food => ({
  id: "one",
  name: "Eggs",
  quantity: 6,
  unit: "pieces",
  category: "Dairy",
  location: "Fridge",
  added: "2026-12-29",
  expiry: "2027-01-01",
  dateType: "use-by",
  notes: "",
  ...over,
});
describe("local calendar dates & safety", () => {
  it("uses the device calendar instead of ISO UTC", () => {
    const d = new Date(2026, 0, 1, 0, 5);
    expect(localDate(d)).toBe("2026-01-01");
  });
  it("handles year, month and leap boundaries", () => {
    expect(dayNumber("2027-01-01") - dayNumber("2026-12-31")).toBe(1);
    expect(dayNumber("2028-03-01") - dayNumber("2028-02-28")).toBe(2);
  });
  it.each([
    ["2026-12-31", "Tomorrow"],
    ["2027-01-01", "Today"],
    ["2026-12-29", "Next 3 days"],
    ["2026-12-25", "Later"],
    ["2027-01-02", "Past use-by"],
  ])("classifies %s", (today, expected) =>
    expect(status(food(), today)).toBe(expected),
  );
  it("handles missing dates and separates past best-before", () => {
    expect(status(food({ expiry: "" }))).toBe("No date");
    expect(status(food({ dateType: "best-before" }), "2027-01-02")).toBe(
      "Past best-before",
    );
    expect(eligible(food(), "2027-01-02")).toBe(false);
    expect(eligible(food({ dateType: "best-before" }), "2027-01-02")).toBe(
      false,
    );
  });
  it("rejects invalid calendar values", () => {
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2026-13-01")).toBe(false);
    expect(validDate("2028-02-29")).toBe(true);
  });
});
describe("inventory & events", () => {
  it("partially consumes and prorates actual estimated value", () => {
    const d = { ...emptyData(), foods: [food({ value: 3 })] };
    const next = consume(d, "one", 2, "eaten", "2027-01-01");
    expect(next.foods[0].quantity).toBe(4);
    expect(next.foods[0].value).toBe(2);
    expect(next.events[0].value).toBe(1);
    expect(d.foods[0].quantity).toBe(6);
  });
  it("removes fully used food and rejects invalid quantities", () => {
    const d = { ...emptyData(), foods: [food()] };
    expect(consume(d, "one", 6, "used").foods).toEqual([]);
    for (const n of [0, -1, 7, NaN, Infinity])
      expect(() => consume(d, "one", n, "used")).toThrow();
  });
  it("counts only discarded entries, ISO weeks and real value", () => {
    let d = { ...emptyData(), foods: [food({ value: 6 })] };
    d = consume(d, "one", 1, "discarded", "2026-12-31");
    d = consume(d, "one", 1, "used", "2027-01-01");
    d = consume(d, "one", 1, "discarded", "2027-01-01");
    const stats = wasteStats(d.events, "2027-01-01");
    expect(stats.week).toBe(2);
    expect(stats.month).toBe(1);
    expect(stats.value).toBe(2);
  });
  it("does not invent financial data", () => {
    const d = consume(
      { ...emptyData(), foods: [food()] },
      "one",
      1,
      "discarded",
    );
    expect(wasteStats(d.events).priced).toEqual([]);
  });
});
describe("offline recipe engine", () => {
  it("contains at least 25 complete cookable recipes", () => {
    expect(recipes.length).toBeGreaterThanOrEqual(25);
    for (const r of recipes) {
      expect(r.steps.length).toBeGreaterThanOrEqual(3);
      expect(r.ingredients.length).toBeGreaterThan(2);
      expect(r.time).toBeGreaterThan(0);
    }
  });
  it("normalizes explicit aliases without guessing unrelated ingredients", () => {
    expect(normalize(" Tomatoes ")).toBe("tomato");
    expect(normalize("Eggs")).toBe("egg");
    expect(normalize("eggplant")).not.toBe("egg");
  });
  it("matches inventory and staples, excludes expired use-by", () => {
    const d = {
      ...emptyData(),
      foods: [
        food(),
        food({ id: "b", name: "Spinach", expiry: "2027-01-03" }),
        food({ id: "c", name: "Cheese", expiry: "" }),
      ],
    };
    expect(
      matchRecipes(d, "2027-01-01").find((r) => r.id === "1")?.missing,
    ).toEqual([]);
    expect(
      matchRecipes(d, "2027-01-02")
        .find((r) => r.id === "1")
        ?.missing.map((i) => i.name),
    ).toContain("egg");
  });
  it("ranks complete matches first and urgent matches before later ones", () => {
    const d = {
      ...emptyData(),
      foods: [
        food({ name: "bread", expiry: "2027-01-05" }),
        food({ id: "b", name: "tomato", expiry: "2027-01-01" }),
      ],
    };
    const matches = matchRecipes(d, "2027-01-01");
    expect(matches[0].id).toBe("7");
    expect(matches[0].urgent).toBe(1);
    expect(matches[0].missing.length).toBe(0);
  });
  it("respects diet and pantry changes", () => {
    const d = emptyData();
    d.settings = { ...d.settings, diet: ["vegan"], staples: [] };
    const result = matchRecipes(d);
    expect(result.every((r) => r.tags.includes("vegan"))).toBe(true);
    expect(
      result.find((r) => r.id === "7")?.missing.map((i) => i.name),
    ).toContain("salt");
  });
});
describe("shopping and backup", () => {
  it("adds missing ingredients once including normalized aliases", () => {
    let d = addShopping(emptyData(), ["tomatoes", "egg"]);
    d = addShopping(d, ["tomato", "eggs", "bread"]);
    expect(d.shopping.map((s) => s.name)).toEqual(["tomatoes", "egg", "bread"]);
  });
  it("round trips all data without mutation", () => {
    const d = { ...emptyData(), foods: [food()] };
    const imported = validateBackup(JSON.parse(JSON.stringify(d)));
    expect(imported).toEqual(d);
    expect(imported).not.toBe(d);
  });
  it("rejects malformed, incompatible and unsafe imports", () => {
    for (const value of [
      null,
      {},
      { ...emptyData(), version: 2 },
      { ...emptyData(), foods: [food({ quantity: -2 })] },
      { ...emptyData(), foods: [food({ expiry: "2027-02-30" })] },
      { ...emptyData(), foods: [food(), food()] },
      { ...emptyData(), settings: { theme: "bad" } },
    ])
      expect(() => validateBackup(value)).toThrow();
  });
});
describe("IndexedDB persistence", () => {
  beforeEach(async () => {
    await db.state.clear();
  });
  it("starts empty, persists edits, removal, shopping and history", async () => {
    expect((await readData()).foods).toEqual([]);
    let d = { ...emptyData(), foods: [food()] };
    await saveData(d);
    expect((await readData()).foods[0].name).toBe("Eggs");
    d.foods[0].name = "Organic eggs";
    d = addShopping(d, ["milk"]);
    await saveData(d);
    expect((await readData()).shopping).toHaveLength(1);
    d = consume(d, "one", 6, "used");
    await saveData(d);
    expect((await readData()).foods).toHaveLength(0);
    expect((await readData()).events).toHaveLength(1);
  });
});
