import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { interpretInventory, type VoiceMode } from "../src/voice/interpret";
import { spokenDate, calendarToday, numberWords } from "../src/voice/dates";
import { reviewInventory, applyVoiceReview } from "../src/voice/reconcile";
import {
  emptyData,
  validateBackup,
  foodAmount,
  foodDateType,
  status,
  type Food,
} from "../src/core";
import { checkIngredient } from "../src/cooking/engine";
import {
  readVoiceDraft,
  storeVoiceDraft,
  clearVoiceDraft,
  validateVoiceDraft,
  type VoiceDraft,
} from "../src/voice/storage";
import { diff, overlay, type Operation } from "../src/family/changes";
import { db, readData, saveData } from "../src/db";
const today = "2026-11-07";
const interpret = (text: string, mode: VoiceMode = "check") =>
  interpretInventory(text, { today, mode });
const rows = (text: string) => interpret(text).items;
const exact = `Okay, so I have like seven eggs… ummm… one pack of milk… there’s also some cheese that’s good until the seventh of November… uhhh…
There’s some ketchup, that’s almost finished… and two tomatoes… oh wait, actually there are four tomatoes… and another carton of milk.`;
const food = (name = "Eggs", quantity = 7): Food => ({
  id: name,
  name,
  quantity,
  unit: "pieces",
  category: "Dairy",
  location: "Fridge",
  added: today,
  expiry: "",
  dateType: "use-by",
  notes: "Original notes",
  value: 5,
});
describe("natural grocery conversation interpretation (transcripts, not microphone accuracy)", () => {
  it("handles the owner's exact messy conversation without doubling tomatoes", () => {
    const r = rows(exact);
    expect(r.map((x) => x.name)).toEqual([
      "Eggs",
      "Milk",
      "Cheese",
      "Ketchup",
      "Tomatoes",
    ]);
    expect(r[0]).toMatchObject({ quantity: 7, unit: "pieces" });
    expect(r[1]).toMatchObject({ quantity: 2, unit: "carton" });
    expect(r[2]).toMatchObject({
      quantity: null,
      expiry: today,
      dateType: "unknown",
    });
    expect(r[3]).toMatchObject({ quantity: null, lowStock: true });
    expect(r[4].quantity).toBe(4);
  });
  it.each([
    ["I have like four apples… no actually six.", "Apples", 6, "pieces"],
    ["Two bottles of water… and another bottle.", "Water", 3, "bottle"],
    ["Three apples and two bananas", "Apples", 3, "pieces"],
    ["half a loaf of bread", "Bread", 0.5, "loaf"],
    ["one loaf of bread", "Bread", 1, "loaf"],
    ["two milk cartons", "Milk", 2, "carton"],
    ["seven eggs two cartons of milk four tomatoes", "Milk", 2, "carton"],
    [
      "Ik heb zeven eieren, twee pakken melk en een beetje kaas.",
      "Milk",
      2,
      "carton",
    ],
    ["Nog drie appels", "Apples", 3, "pieces"],
    ["Ik heb vier appels. Nee eigenlijk zes.", "Apples", 6, "pieces"],
    [
      "I have two cartons of milk, and another carton of milk",
      "Milk",
      3,
      "carton",
    ],
    ["I have twenty one eggs", "Eggs", 21, "pieces"],
    ["Ik heb drieëntwintig eieren", "Eggs", 23, "pieces"],
  ])("understands %s", (text, name, quantity, unit) =>
    expect(rows(text).find((x) => x.name === name)).toMatchObject({
      quantity,
      unit,
    }),
  );
  it.each([
    ["four apples. No, six.", 6],
    ["one and a half loaves of bread", 1.5],
    ["anderhalf brood", 1.5],
  ])(
    "handles additional natural amounts and corrections: %s",
    (text, quantity) => expect(rows(text)[0].quantity).toBe(quantity),
  );
  it.each([
    ["Ik heb 1,5 liter melk", 1.5],
    ["I have 0.5 litres of milk", 0.5],
  ])("keeps explicitly spoken decimal amounts for %s", (text, quantity) =>
    expect(rows(text)[0]).toMatchObject({
      name: "Milk",
      quantity,
      unit: "litre",
    }),
  );
  it("keeps milk identity when corrected to oat milk", () =>
    expect(rows("Milk… actually, make that oat milk.")).toMatchObject([
      { name: "Oat drink", quantity: null },
    ]));
  it("does not lose an earlier grocery when actually introduces an additional product", () =>
    expect(
      rows("Seven eggs. Actually there's also cheese.").map((x) => x.name),
    ).toEqual(["Eggs", "Cheese"]));
  it("resolves an additional package to a unique earlier matching unit", () => {
    const r = rows(
      "Two bottles of water. Two cartons of milk. Another bottle.",
    );
    expect(r.find((x) => x.name === "Water")?.quantity).toBe(3);
    expect(r.find((x) => x.name === "Milk")?.quantity).toBe(2);
  });
  it("retains the count while renaming a product", () =>
    expect(rows("Two cartons of milk. No I meant oat milk.")).toMatchObject([
      { name: "Oat drink", quantity: 2, unit: "carton" },
    ]));
  it("does not invent amounts for some or a few", () => {
    expect(rows("Some cheese, a few carrots").map((x) => x.quantity)).toEqual([
      null,
      null,
    ]);
  });
  it.each([
    "There's ketchup, barely any left.",
    "We're running low on ketchup.",
    "Er is bijna geen ketchup meer.",
    "There's ketchup, not much left.",
  ])("records low stock for %s", (text) =>
    expect(rows(text)[0]).toMatchObject({
      name: "Ketchup",
      quantity: null,
      lowStock: true,
    }),
  );
  it("marks a need for more without inventing a quantity", () =>
    expect(rows("We need more milk")[0]).toMatchObject({
      name: "Milk",
      quantity: null,
      lowStock: true,
    }));
  it("does not interpret one nearly empty carton as a total of one", () =>
    expect(
      rows("Two milk cartons. One of those is almost empty.")[0],
    ).toMatchObject({ quantity: 2, lowStock: true }));
  it("does not double-count repeated mentions", () =>
    expect(rows("Seven eggs. Seven eggs. There's also eggs.")).toMatchObject([
      { name: "Eggs", quantity: 7 },
    ]));
  it("tracks corrections to named earlier items after other groceries", () => {
    const r = rows(
      "Three tomatoes, milk and cheese. The tomatoes, actually make it five.",
    );
    expect(r.find((x) => x.name === "Tomatoes")?.quantity).toBe(5);
  });
  it("keeps an unclear additional total unknown", () => {
    expect(rows("Some milk, another carton of milk")[0].quantity).toBeNull();
  });
  it("flags ambiguous references instead of guessing", () => {
    const r = interpret("Milk cheese. That's good until tomorrow.");
    expect(r.items.every((x) => !x.expiry)).toBe(true);
    expect(r.unresolved.join()).toMatch(/Which item/);
  });
  it("exposes unknown speech and does not create filler groceries", () => {
    expect(rows("Uhhhh. Let me see. I think.")).toEqual([]);
    expect(
      interpret("I have something unrecognizable called zzz").unresolved.length,
    ).toBeGreaterThan(0);
  });
  it("retains canonical Dutch names and compound product identities", () => {
    expect(
      rows("Twee zoete aardappelen en tomatenblokjes").map((x) => x.name),
    ).toEqual(["Sweet potato", "Canned tomato"]);
  });
  it("supports explicit units without carton-to-litre conversion", () => {
    expect(rows("two cartons of milk")[0]).toMatchObject({
      quantity: 2,
      unit: "carton",
    });
    expect(rows("500 grams of cheese")[0]).toMatchObject({
      quantity: 500,
      unit: "g",
    });
  });
  it("suggests a purchase mode without silently applying it", () =>
    expect(interpret("I bought seven eggs").suggestedMode).toBe("purchase"));
  it("applies storage only when spoken, or an editable product suggestion", () => {
    expect(rows("Milk in the pantry")[0]).toMatchObject({
      location: "Pantry",
      locationSpoken: true,
    });
    expect(rows("milk")[0]).toMatchObject({
      location: "Fridge",
      locationSpoken: false,
    });
  });
});
describe("spoken local calendar dates", () => {
  it.each([
    ["Good until November seventh", "2026-11-07", undefined],
    ["Expires tomorrow", "2026-11-08", undefined],
    ["Best before next Monday", "2026-11-09", "best-before"],
    ["Use by the fifteenth", "2026-11-15", "use-by"],
    ["This cheese is good for another three days", "2026-11-10", undefined],
    ["ten minste houdbaar tot volgende maandag", "2026-11-09", "best-before"],
    ["te gebruiken tot morgen", "2026-11-08", "use-by"],
    ["houdbaar tot vijftien november", "2026-11-15", undefined],
    ["good until the tenth of November 2027", "2027-11-10", undefined],
  ])("resolves %s with review", (text, date, type) =>
    expect(spokenDate(text, today)).toMatchObject({ date, type }),
  );
  it("carries contextual dates across finalized speech segments", () =>
    expect(
      rows("There's cheese.\nIt's good until next Friday.")[0],
    ).toMatchObject({
      expiry: "2026-11-13",
      dateType: "unknown",
      expirySpoken: true,
    }));
  it("does not assign an expiry number to a later grocery", () => {
    const r = rows("Cheese good until November seventh milk");
    expect(r.find((x) => x.name === "Milk")?.quantity).toBeNull();
  });
  it("handles month/year and DST boundaries with calendar arithmetic", () => {
    expect(spokenDate("Expires tomorrow", "2026-12-31")?.date).toBe(
      "2027-01-01",
    );
    expect(spokenDate("good for another three days", "2026-03-28")?.date).toBe(
      "2026-03-31",
    );
  });
  it("uses the selected timezone rather than UTC when the date differs", () => {
    const d = new Date("2026-11-07T23:30:00Z");
    expect(calendarToday(d, "Europe/Amsterdam")).toBe("2026-11-08");
    expect(calendarToday(d, "America/Los_Angeles")).toBe("2026-11-07");
  });
  it("exposes past dates and missing years for confirmation", () =>
    expect(spokenDate("good until November first", today)?.reason).toMatch(
      /current year.*past/,
    ));
  it("rejects impossible dates without silently changing them", () =>
    expect(spokenDate("expires February thirtieth", today)).toMatchObject({
      date: "",
    }));
  it("does not create an expiry from unrelated quantities", () =>
    expect(spokenDate("three cartons of milk", today)).toBeNull());
  it("understands Dutch and English compound/ordinal numbers", () =>
    expect(numberWords("twenty first eenentwintig vijftiende")).toBe(
      "21 21 15",
    ));
});
describe("confirmed inventory reconciliation and family deltas", () => {
  it("replaces a stock total instead of adding it again", () => {
    const d = { ...emptyData(), foods: [food()] };
    const r = reviewInventory(rows("I have seven eggs"), d, "check");
    expect(applyVoiceReview(d, d, r, today).foods).toHaveLength(1);
    expect(applyVoiceReview(d, d, r, today).foods[0].quantity).toBe(7);
  });
  it("adds purchases as a separate batch", () => {
    const d = { ...emptyData(), foods: [food()] };
    expect(
      applyVoiceReview(
        d,
        d,
        reviewInventory(rows("seven eggs"), d, "purchase"),
        today,
      ).foods,
    ).toHaveLength(2);
  });
  it("preserves known quantities and unspoken details for low-stock descriptions", () => {
    const f = { ...food("Milk", 2), unit: "carton", expiry: "2026-11-10" };
    const d = { ...emptyData(), foods: [f] };
    const result = applyVoiceReview(
      d,
      d,
      reviewInventory(rows("The milk is nearly empty"), d, "check"),
      today,
    ).foods[0];
    expect(result).toMatchObject({ ...f, lowStock: true });
  });
  it("adds unspecified presence without inventing an actual count or date type", () => {
    const d = emptyData(),
      r = applyVoiceReview(
        d,
        d,
        reviewInventory(rows("Some cheese good until tomorrow"), d, "check"),
        today,
      );
    expect(r.foods[0]).toMatchObject({
      quantityUnknown: true,
      unit: "unspecified",
      dateTypeUnconfirmed: true,
    });
    expect(foodAmount(r.foods[0])).toBe("Quantity unspecified");
    expect(foodDateType(r.foods[0])).toBe("Date type unconfirmed");
  });
  it("requires selecting between multiple matching existing batches", () => {
    const d = { ...emptyData(), foods: [food(), { ...food(), id: "second" }] };
    const r = reviewInventory(rows("seven eggs"), d, "check");
    expect(r[0].action).toBe("choose");
    expect(() => applyVoiceReview(d, d, r, today)).toThrow(/Choose/);
  });
  it("rejects stale household changes and duplicate target selections atomically", () => {
    const d = { ...emptyData(), foods: [food()] };
    const r = reviewInventory(rows("six eggs"), d, "check");
    const current = { ...d, foods: [food("Eggs", 5)] };
    expect(() => applyVoiceReview(current, d, r, today)).toThrow(/changed/);
    expect(() =>
      applyVoiceReview(d, d, [r[0], { ...r[0], id: "twice" }], today),
    ).toThrow(/different existing/);
    expect(d.foods[0].quantity).toBe(7);
  });
  it("requires explicit reconciliation when spoken units differ from recorded units", () => {
    const d = {
      ...emptyData(),
      foods: [{ ...food("Milk", 2), unit: "litre" }],
    };
    const review = reviewInventory(rows("two cartons of milk"), d, "check");
    expect(review[0].action).toBe("choose");
    expect(() => applyVoiceReview(d, d, review, today)).toThrow(/Choose/);
  });
  it("never clears an existing expiry because a spoken date was incomplete", () => {
    const f = { ...food("Cheese", 200), unit: "g", expiry: "2026-11-15" },
      d = { ...emptyData(), foods: [f] };
    const review = reviewInventory(rows("Cheese best before"), d, "check");
    expect(applyVoiceReview(d, d, review, today).foods[0].expiry).toBe(
      f.expiry,
    );
  });
  it("supports explicitly confirmed increases and rejects incompatible units/dates", () => {
    const d = { ...emptyData(), foods: [food()] };
    const r = reviewInventory(rows("two eggs"), d, "check");
    r[0].action = "increase";
    expect(applyVoiceReview(d, d, r, today).foods[0].quantity).toBe(9);
    r[0].unit = "kg";
    expect(() => applyVoiceReview(d, d, r, today)).toThrow(
      /confirm a quantity/,
    );
  });
  it("does not add shopping suggestions without explicit confirmation", () => {
    const d = emptyData(),
      r = reviewInventory(rows("we need more milk"), d, "check");
    expect(applyVoiceReview(d, d, r, today).shopping).toEqual([]);
    r[0].addToShopping = true;
    expect(applyVoiceReview(d, d, r, today).shopping[0].name).toBe("Milk");
  });
  it("prevents retrying a successfully applied new review", () => {
    const d = emptyData(),
      r = reviewInventory(rows("seven eggs"), d, "purchase"),
      after = applyVoiceReview(d, d, r, today);
    expect(() => applyVoiceReview(after, d, r, today)).toThrow(
      /changed|already saved/,
    );
  });
  it("does not upload full transcripts or draft-only information", () => {
    const d = emptyData(),
      r = reviewInventory(rows(exact), d, "check"),
      after = applyVoiceReview(d, d, r, today);
    const changes = JSON.stringify(diff(d, after));
    expect(changes).not.toMatch(/ummm|warnings|transcript|sources|newId/);
    expect(validateBackup(JSON.parse(JSON.stringify(after)))).toEqual(after);
  });
  it("synchronizes low-stock and unknown fields through existing deltas and preserves unrelated items", () => {
    const d = { ...emptyData(), foods: [food()] },
      r = reviewInventory(rows("The eggs are nearly empty"), d, "check"),
      after = applyVoiceReview(d, d, r, today);
    const op: Operation = {
      id: "voice-op",
      changes: diff(d, after),
      label: "voice",
      created: new Date().toISOString(),
    };
    const remote = { ...d, foods: [...d.foods, food("Milk", 2)] };
    expect(
      overlay(remote, [op]).data.foods.find((f) => f.name === "Eggs")?.lowStock,
    ).toBe(true);
    expect(overlay(remote, [op]).data.foods).toHaveLength(2);
  });
  it("rejects invalid optional flags in backups", () => {
    const d = { ...emptyData(), foods: [{ ...food(), lowStock: "yes" }] };
    expect(() => validateBackup(d)).toThrow();
  });
  it("never claims an unspecified egg count is enough for a recipe", () => {
    const d = emptyData(),
      after = applyVoiceReview(
        d,
        d,
        reviewInventory(rows("Some eggs"), d, "check"),
        today,
      );
    expect(
      checkIngredient(
        { name: "eggs", quantity: 2, unit: "pieces", amount: "2 pieces" },
        after,
        today,
      ).status,
    ).toBe("verify");
  });
  it("does not recommend past dates with an unconfirmed type", () => {
    const d = emptyData(),
      after = applyVoiceReview(
        d,
        d,
        reviewInventory(rows("eggs good until November first"), d, "check"),
        today,
      );
    expect(status(after.foods[0], today)).toBe("Past date · check label");
    expect(
      checkIngredient(
        { name: "eggs", quantity: 2, unit: "pieces", amount: "2 pieces" },
        after,
        today,
      ).status,
    ).toBe("missing");
  });
});
describe("private voice drafts and local persistence", () => {
  beforeEach(async () => {
    await db.caches.clear();
  });
  const draft = (): VoiceDraft => ({
    version: 1,
    text: exact,
    pending: "some last phrase",
    mode: "check",
    language: "en-GB",
    timeZone: "Europe/Amsterdam",
    phase: "capture",
    rows: [],
    baseline: emptyData(),
    resolvedDate: today,
  });
  it("persists segment accumulation without sharing it across accounts or households", async () => {
    await storeVoiceDraft("userA:houseA", draft());
    expect((await readVoiceDraft("userA:houseA"))?.text).toBe(exact);
    expect(await readVoiceDraft("userB:houseA")).toBeNull();
    expect(await readVoiceDraft("userA:houseB")).toBeNull();
    await clearVoiceDraft("userA:houseA");
    expect(await readVoiceDraft("userA:houseA")).toBeNull();
  });
  it("restores reviewed rows and the original concurrency baseline", async () => {
    const d = draft();
    d.phase = "review";
    d.rows = reviewInventory(rows(exact), d.baseline, "check");
    await storeVoiceDraft("one", d);
    expect(await readVoiceDraft("one")).toEqual(d);
  });
  it("rejects corrupt drafts, unknown modes and excessive transcripts", () => {
    for (const patch of [
      { text: "x".repeat(18001) },
      { mode: "guess" },
      { timeZone: "not-a-zone" },
      { rows: [{}] },
    ])
      expect(() => validateVoiceDraft({ ...draft(), ...patch })).toThrow();
  });
  it("preserves confirmed flags through the actual IndexedDB adapter", async () => {
    const d = emptyData(),
      after = applyVoiceReview(
        d,
        d,
        reviewInventory(rows("Some cheese nearly empty"), d, "check"),
        today,
      );
    await saveData(after);
    expect(await readData()).toEqual(after);
  });
});
