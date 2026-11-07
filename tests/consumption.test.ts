import { describe, it, expect } from "vitest";
import {
  emptyData,
  validateBackup,
  wasteStats,
  type Food,
  type Data,
} from "../src/core";
import { interpretInventory, type VoiceMode } from "../src/voice/interpret";
import {
  reviewInventory,
  applyVoiceReview,
  type VoiceReview,
} from "../src/voice/reconcile";
import { diff, overlay, type Operation } from "../src/family/changes";
import { validateVoiceDraft } from "../src/voice/storage";
const today = "2026-11-07";
const food = (
  name: string,
  quantity: number,
  unit = "pieces",
  id = name,
  expiry = "2026-11-10",
): Food => ({
  id,
  name,
  quantity,
  unit,
  category:
    name === "Eggs" || name === "Cheese" || name === "Milk"
      ? "Dairy"
      : "Produce",
  location: "Fridge",
  added: today,
  expiry,
  dateType: "best-before",
  notes: "Keep original notes",
  value: quantity,
});
const kitchen = (): Data => ({
  ...emptyData(),
  foods: [
    food("Tomatoes", 10),
    food("Eggs", 6),
    food("Cheese", 200, "g"),
    food("Olive oil", 300, "ml"),
    food("Pasta", 500, "g"),
    food("Bananas", 5),
    food("Milk", 2, "carton"),
  ],
});
const parse = (text: string, d = kitchen(), mode: VoiceMode = "check") =>
  interpretInventory(text, { today, mode, existing: d.foods });
const review = (text: string, d = kitchen(), mode: VoiceMode = "check") =>
  reviewInventory(parse(text, d, mode).items, d, mode, today);
const only = (text: string, d = kitchen()) => review(text, d)[0];
describe("recipe-independent natural consumption intent", () => {
  it("understands the exact cooking example and ignores the meal title as an ingredient", () => {
    const r = review(
      "I just made pasta. I used three tomatoes, two eggs, half the cheese, and some olive oil.",
    );
    expect(r.map((x) => x.name)).toEqual([
      "Tomatoes",
      "Eggs",
      "Cheese",
      "Olive oil",
    ]);
    expect(r.every((x) => x.action === "consume")).toBe(true);
    expect(r.map((x) => x.allocations?.[0]?.amount)).toEqual([3, 2, 100, null]);
    expect(r.every((x) => x.consumption?.kind === "used")).toBe(true);
  });
  it.each([
    ["I ate two bananas.", "Bananas", "eaten", 2],
    ["We finished the milk.", "Milk", "used", 2],
    ["I used the last three eggs.", "Eggs", "used", 3],
    ["Actually, I used four eggs, not three.", "Eggs", "used", 4],
    ["Ik heb drie tomaten en twee eieren gebruikt.", "Tomatoes", "used", 3],
    ["Ik at twee bananen.", "Bananas", "eaten", 2],
    ["Ik heb de melk opgemaakt.", "Milk", "used", 2],
    ["Ik heb drie tomaten weggegooid.", "Tomatoes", "discarded", 3],
    ["I threw away three spoiled tomatoes.", "Tomatoes", "discarded", 3],
  ])("detects %s without adding groceries", (text, name, kind, amount) => {
    const r = review(text);
    const item = r.find((x) => x.name === name);
    expect(item).toMatchObject({ action: "consume", consumption: { kind } });
    expect(item?.allocations?.[0]?.amount).toBe(amount);
  });
  it.each([
    ["I've used two eggs", "Eggs", 2],
    ["Ik heb twee bananen gegeten", "Bananas", 2],
    ["Ik heb 1,5 liter melk gebruikt", "Milk", null],
  ])(
    "supports common contractions and Dutch action order: %s",
    (text, name, amount) => {
      const r = only(text);
      expect(r.action).toBe("consume");
      expect(r.name).toBe(name);
      expect(r.allocations?.[0]?.amount).toBe(amount);
    },
  );
  it("does not deduct a meal name in contracted casual speech", () =>
    expect(
      review("I've just made pasta. I've used two eggs.").map((r) => r.name),
    ).toEqual(["Eggs"]));
  it("supports a bare ingredient list in the dedicated used mode", () => {
    const r = review("three tomatoes, two eggs", kitchen(), "consume");
    expect(r.every((x) => x.action === "consume")).toBe(true);
  });
  it("keeps additions, stock checks and use as separate explicit intents", () => {
    const r = review(
      "I bought two eggs. I used one egg. We have three tomatoes.",
    );
    expect(r.map((x) => [x.name, x.action])).toEqual([
      ["Eggs", "new"],
      ["Eggs", "consume"],
      ["Tomatoes", "replace"],
    ]);
  });
  it("does not turn nearly finished stock into actual consumption", () => {
    expect(only("The ketchup is almost finished").action).toBe("new");
    expect(only("The milk is nearly empty").action).toBe("replace");
  });
  it("handles corrections and fillers without duplicate deduction rows", () => {
    const r = review(
      "Ummm I used three eggs. Oh wait, actually I used four eggs, not three.",
    );
    expect(r).toHaveLength(1);
    expect(r[0].allocations?.[0]?.amount).toBe(4);
  });
  it("does not replace a correction with the explicitly negated old count", () =>
    expect(
      only("I used three eggs. Actually I used four eggs, not three eggs.")
        .allocations?.[0]?.amount,
    ).toBe(4));
  it("does not act on a negated use statement", () => {
    expect(parse("I did not use two eggs").items).toEqual([]);
  });
  it.each([
    "I used some olive oil",
    "I used a little butter",
    "I used almost all the pasta",
  ])("leaves vague amounts unresolved: %s", (text) => {
    const r = review(text);
    expect(r[0].consumption?.amount).toBe("unclear");
    expect(r[0].allocations?.every((x) => x.amount === null) ?? true).toBe(
      true,
    );
    expect(() => applyVoiceReview(kitchen(), kitchen(), r, today)).toThrow();
  });
  it("records discarded intent when the unquantified spoiled tomatoes need amount clarification", () =>
    expect(only("I threw away the spoiled tomatoes")).toMatchObject({
      consumption: { kind: "discarded", amount: "unclear" },
    }));
});
describe("explicit fractions, units and expiry-batch matching", () => {
  it("takes half of a known matching batch rather than inventing a unit", () => {
    const r = only("I used half the cheese");
    expect(r.allocations?.[0]).toMatchObject({ id: "Cheese", amount: 100 });
  });
  it("treats half a loaf as an absolute amount, not half all the bread", () => {
    const d = { ...emptyData(), foods: [food("Bread", 2, "loaf")] };
    expect(
      only("I used half a loaf of bread", d).allocations?.[0]?.amount,
    ).toBe(0.5);
  });
  it("requires selecting which batch a relative fraction refers to", () => {
    const d = kitchen();
    d.foods.push(food("Cheese", 100, "g", "other-cheese"));
    const r = only("I used half the cheese", d);
    expect(r.allocations).toEqual([]);
    expect(() => applyVoiceReview(d, d, [r], today)).toThrow(/Choose/);
  });
  it("splits a numeric amount across compatible earliest-expiry batches and shows the split", () => {
    const d = {
      ...emptyData(),
      foods: [
        food("Tomatoes", 2, "pieces", "soon", "2026-11-08"),
        food("Tomatoes", 5, "pieces", "later", "2026-11-11"),
      ],
    };
    const r = only("I used three tomatoes", d);
    expect(r.allocations).toEqual([
      { id: "soon", amount: 2, whole: false },
      { id: "later", amount: 1, whole: false },
    ]);
    expect(r.warnings.join()).toMatch(/earliest-expiry/);
  });
  it("does not guess between fresh and frozen/different-category batches", () => {
    const d = kitchen();
    d.foods.push({
      ...food("Tomatoes", 5, "pieces", "frozen"),
      location: "Freezer",
    });
    expect(only("I used three tomatoes", d).allocations).toEqual([]);
  });
  it("matches a spoken location or expiry batch when explicit", () => {
    const d = kitchen();
    d.foods.push({
      ...food("Tomatoes", 4, "pieces", "frozen"),
      location: "Freezer",
    });
    expect(
      only("I used two tomatoes from the freezer", d).allocations?.[0]?.id,
    ).toBe("frozen");
  });
  it("never silently caps an amount above recorded stock", () => {
    const r = only("I used fifty eggs");
    expect(r.allocations?.[0]?.amount).toBeNull();
  });
  it("never converts a carton to invented litres", () => {
    const d = { ...emptyData(), foods: [food("Milk", 1, "litre")] };
    const r = only("I used one carton of milk", d);
    expect(r.allocations?.[0]?.amount).toBeNull();
    expect(r.warnings.join()).toMatch(/not invented/);
  });
  it("supports real conversions only when both units are explicit and compatible", () => {
    const d = { ...emptyData(), foods: [food("Cheese", 1, "kg")] };
    expect(only("I used 250 grams of cheese", d).allocations?.[0]?.amount).toBe(
      0.25,
    );
  });
  it("does not automatically allocate past-date food for reported use but permits an explicit truthful record", () => {
    const d = {
      ...emptyData(),
      foods: [
        {
          ...food("Tomatoes", 3, "pieces", "past", "2026-11-01"),
          dateType: "use-by" as const,
        },
        food("Tomatoes", 3, "pieces", "current"),
      ],
    };
    expect(only("I used one tomato", d).allocations?.[0]?.id).toBe("current");
    const r = only("I threw away three tomatoes", d);
    expect(r.allocations?.[0]?.id).toBe("past");
  });
  it("does not assign a fraction to an unknown quantity sentinel", () => {
    const d = {
      ...emptyData(),
      foods: [{ ...food("Cheese", 1, "unspecified"), quantityUnknown: true }],
    };
    expect(
      only("I used half the cheese", d).allocations?.[0]?.amount,
    ).toBeNull();
  });
  it("can explicitly finish a whole item whose original amount was unknown", () => {
    const d = {
      ...emptyData(),
      foods: [{ ...food("Milk", 1, "unspecified"), quantityUnknown: true }],
    };
    const r = review("We finished the milk", d);
    expect(applyVoiceReview(d, d, r, today).foods).toEqual([]);
  });
});
describe("confirmed atomic deductions, waste and family persistence", () => {
  it("keeps partial quantities and records ordinary cooking independently of recipes", () => {
    const d = kitchen(),
      r = review("I used three tomatoes and two eggs", d),
      next = applyVoiceReview(d, d, r, today);
    expect(next.foods.find((x) => x.name === "Tomatoes")?.quantity).toBe(7);
    expect(next.foods.find((x) => x.name === "Eggs")?.quantity).toBe(4);
    expect(next.events.map((e) => e.action)).toEqual(["used", "used"]);
    expect(d.events).toEqual([]);
    expect(d.foods.find((x) => x.name === "Eggs")?.quantity).toBe(6);
  });
  it("records eating separately from discard and waste totals", () => {
    const d = kitchen(),
      r = review("I ate two bananas. I threw away three tomatoes.", d),
      next = applyVoiceReview(d, d, r, today);
    expect(next.events.map((e) => e.action)).toEqual(["eaten", "discarded"]);
    expect(wasteStats(next.events, today).month).toBe(1);
  });
  it("requires clarification before any row is committed, then accepts an edited amount", () => {
    const d = kitchen(),
      r = review("I used three tomatoes and some olive oil", d);
    expect(() => applyVoiceReview(d, d, r, today)).toThrow(/actual amount/);
    expect(d.events).toEqual([]);
    r[1].allocations![0].amount = 15;
    const next = applyVoiceReview(d, d, r, today);
    expect(next.foods.find((x) => x.name === "Olive oil")?.quantity).toBe(285);
  });
  it("rejects a manually corrupted allocation that targets another product", () => {
    const d = kitchen(),
      r = review("I used two eggs", d);
    r[0].allocations![0].id = "Tomatoes";
    expect(() => applyVoiceReview(d, d, r, today)).toThrow(
      /correct recorded product/,
    );
  });
  it("rejects a stale batch without partial inventory changes", () => {
    const d = kitchen(),
      r = review("I used three tomatoes and two eggs", d),
      changed = structuredClone(d);
    changed.foods.find((x) => x.name === "Eggs")!.quantity = 4;
    expect(() => applyVoiceReview(changed, d, r, today)).toThrow(/changed/);
    expect(changed.events).toEqual([]);
  });
  it("prevents retrying the same confirmed deduction even if stock was replenished", () => {
    const d = kitchen(),
      r = review("I used two eggs", d),
      next = applyVoiceReview(d, d, r, today);
    next.foods = structuredClone(d.foods);
    expect(() => applyVoiceReview(next, d, r, today)).toThrow(
      /already recorded/,
    );
  });
  it("does not permit negative stock, repeated allocation IDs, or guessed amounts", () => {
    const d = kitchen(),
      r = review("I used two eggs", d);
    r[0].allocations![0].amount = 7;
    expect(() => applyVoiceReview(d, d, r, today)).toThrow();
    r[0].allocations![0].amount = 2;
    r[0].allocations!.push({ ...r[0].allocations![0] });
    expect(() => applyVoiceReview(d, d, r, today)).toThrow(/same batch/);
  });
  it("keeps cooking and eating events separate when deducting from one batch", () => {
    const d = kitchen(),
      r = review("I used two eggs. I ate one egg.", d),
      next = applyVoiceReview(d, d, r, today);
    expect(next.foods.find((x) => x.name === "Eggs")?.quantity).toBe(3);
    expect(next.events.map((e) => e.action)).toEqual(["used", "eaten"]);
  });
  it("does not combine stock correction and consumption of the same batch implicitly", () => {
    const d = kitchen(),
      r = review("We have five eggs. I used two eggs.", d);
    expect(() => applyVoiceReview(d, d, r, today)).toThrow(/separately/);
  });
  it("syncs inventory and events as one existing household change batch", () => {
    const d = kitchen(),
      r = review("I used two eggs", d),
      next = applyVoiceReview(d, d, r, today),
      changes = diff(d, next);
    expect(changes.map((c) => c.table).sort()).toEqual([
      "activity_events",
      "inventory_items",
    ]);
    const op: Operation = {
      id: "consumption",
      changes,
      created: new Date().toISOString(),
      label: "used",
    };
    const remote = {
      ...d,
      shopping: [
        { id: "unrelated", name: "Bread", quantity: "1", checked: false },
      ],
    };
    const synced = overlay(remote, [op]);
    expect(synced.conflict).toBeUndefined();
    expect(synced.data.foods.find((f) => f.name === "Eggs")?.quantity).toBe(4);
    expect(synced.data.shopping).toHaveLength(1);
  });
  it("preserves deductions, event kinds and optional flags through existing backups", () => {
    const d = kitchen(),
      next = applyVoiceReview(d, d, review("I ate two bananas", d), today);
    expect(validateBackup(JSON.parse(JSON.stringify(next)))).toEqual(next);
  });
  it("validates consumption drafts without uploading their language state", () => {
    const d = kitchen(),
      r = review("I used two eggs", d);
    expect(() =>
      validateVoiceDraft({
        version: 1,
        text: "I used two eggs",
        pending: "",
        mode: "consume",
        language: "en-GB",
        timeZone: "Europe/Amsterdam",
        phase: "review",
        rows: r,
        baseline: d,
        resolvedDate: today,
      }),
    ).not.toThrow();
    const next = applyVoiceReview(d, d, r, today);
    expect(JSON.stringify(diff(d, next))).not.toMatch(
      /consumption|allocations|I used two eggs/,
    );
  });
  it("rejects malformed allocation metadata in private draft restore", () => {
    const d = kitchen(),
      r = review("I used two eggs", d);
    (r[0] as VoiceReview).allocations = [
      { id: "Eggs", amount: -2, whole: false },
    ];
    expect(() =>
      validateVoiceDraft({
        version: 1,
        text: "",
        pending: "",
        mode: "consume",
        language: "en-GB",
        timeZone: "Europe/Amsterdam",
        phase: "review",
        rows: r,
        baseline: d,
        resolvedDate: today,
      }),
    ).toThrow();
  });
});
