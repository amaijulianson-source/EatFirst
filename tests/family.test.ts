import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import Dexie from "dexie";
import {
  diff,
  overlay,
  canonical,
  mergeLocal,
  fromSnapshot,
  type Operation,
} from "../src/family/changes";
import {
  emptyData,
  purchaseItem,
  addShopping,
  validateBackup,
  type Food,
} from "../src/core";
import { db, readData, saveData, preserveBackup, EatFirstDB } from "../src/db";
const f = (id = "one", quantity = 2): Food => ({
  id,
  name: "Tomatoes",
  quantity,
  unit: "pieces",
  category: "Produce",
  location: "Fridge",
  added: "2026-11-06",
  expiry: "2026-11-08",
  dateType: "best-before",
  notes: "",
});
const op = (changes: ReturnType<typeof diff>, id = "op1"): Operation => ({
  id,
  changes,
  created: "2026-11-06T10:00:00Z",
  label: "test",
});
describe("shared changes and predictable offline conflicts", () => {
  it("uses per-record deltas, leaving unrelated household changes intact", () => {
    const before = { ...emptyData(), foods: [f()] };
    const after = { ...before, foods: [f("one", 1)] };
    const change = diff(before, after);
    expect(change).toHaveLength(1);
    const remote = { ...before, foods: [f(), f("new", 4)] };
    const result = overlay(remote, [op(change)]);
    expect(result.conflict).toBeUndefined();
    expect(result.data.foods.map((x) => x.quantity)).toEqual([4, 1]);
  });
  it("keeps the full proposal while marking a simultaneous edit for review", () => {
    const before = { ...emptyData(), foods: [f()] };
    const after = { ...before, foods: [f("one", 1)] };
    const result = overlay({ ...before, foods: [f("one", 3)] }, [
      op(diff(before, after)),
    ]);
    expect(result.conflict).toEqual({
      operation: "op1",
      table: "inventory_items",
      key: "one",
    });
    expect(result.data.foods[0].quantity).toBe(1);
  });
  it("preserves deletion conflicts rather than silently dropping a queued edit", () => {
    const before = { ...emptyData(), foods: [f()] };
    const result = overlay(emptyData(), [
      op(diff(before, { ...before, foods: [f("one", 1)] })),
    ]);
    expect(result.conflict?.key).toBe("one");
    expect(result.data.foods[0].quantity).toBe(1);
  });
  it("replays sequential offline edits against their own expected values", () => {
    const a = { ...emptyData(), foods: [f()] };
    const b = { ...a, foods: [f("one", 1.5)] };
    const c = { ...b, foods: [f("one", 1)] };
    const result = overlay(a, [op(diff(a, b)), op(diff(b, c), "op2")]);
    expect(result.conflict).toBeUndefined();
    expect(result.data.foods[0].quantity).toBe(1);
  });
  it("does not share per-device theme changes", () => {
    const a = emptyData(),
      b = { ...a, settings: { ...a.settings, theme: "dark" as const } };
    expect(diff(a, b)).toEqual([]);
    expect(
      diff(a, { ...a, settings: { ...a.settings, currency: "EUR" } })[0].table,
    ).toBe("settings");
  });
  it("canonicalizes key order and undefined optional fields", () => {
    expect(canonical({ b: 1, a: 2, x: undefined })).toBe(
      canonical({ a: 2, b: 1 }),
    );
  });
  it("validates untrusted cloud snapshots before replacing the cache", () => {
    expect(() => fromSnapshot({ foods: [{ id: "hack" }] }, "light")).toThrow();
    const d = emptyData();
    expect(fromSnapshot({ ...d, frequent: [] }, "dark").settings.theme).toBe(
      "dark",
    );
  });
});
describe("confirmed migration and retained legacy data", () => {
  beforeEach(async () => {
    await db.state.clear();
    await db.backups.clear();
    await db.caches.clear();
  });
  it("merges exact IDs once and skips duplicate active shopping names", () => {
    const local = addShopping({ ...emptyData(), foods: [f()] }, ["Milk"]);
    const current = addShopping({ ...emptyData(), foods: [f()] }, ["Milk"]);
    const merged = mergeLocal(current, local);
    expect(merged.foods).toHaveLength(1);
    expect(merged.shopping).toHaveLength(1);
  });
  it("blocks differing records with matching IDs", () => {
    expect(() =>
      mergeLocal(
        { ...emptyData(), foods: [f("one", 1)] },
        { ...emptyData(), foods: [f()] },
      ),
    ).toThrow(/same ID/);
  });
  it("retains a restorable original local backup while saving separate household cache", async () => {
    const local = { ...emptyData(), foods: [f()] };
    await saveData(local);
    await preserveBackup(local, "Before migration");
    await db.caches.put({ id: "user-a:house-a", value: { data: emptyData() } });
    expect((await readData()).foods).toEqual(local.foods);
    const backup = (await db.backups.toArray())[0];
    expect(validateBackup(backup.data)).toEqual(local);
  });
  it("keeps different accounts’ household cache keys separate", async () => {
    await db.caches.bulkPut([
      { id: "user-a:house-a", value: { foods: [f()] } },
      { id: "user-b:house-b", value: { foods: [] } },
    ]);
    expect(await db.caches.get("user-b:house-a")).toBeUndefined();
  });
});
describe("shared shopping history", () => {
  it("counts a purchase once and includes frequencies in validated backups", () => {
    let d = addShopping(emptyData(), ["Milk"]);
    const id = d.shopping[0].id;
    d = purchaseItem(d, id, true, "2026-11-06");
    d = purchaseItem(d, id, true, "2026-11-06");
    expect(d.frequent?.[0].count).toBe(1);
    expect(
      validateBackup(JSON.parse(JSON.stringify(d))).frequent?.[0].name,
    ).toBe("Milk");
  });
  it("re-adds an already purchased item without duplicating its row", () => {
    let d = addShopping(emptyData(), ["Tomatoes"]);
    d = purchaseItem(d, d.shopping[0].id, true, "2026-11-06");
    d = addShopping(d, ["tomato"]);
    expect(d.shopping).toHaveLength(1);
    expect(d.shopping[0].checked).toBe(false);
    d = purchaseItem(d, d.shopping[0].id, true, "2026-11-07");
    expect(d.frequent?.[0].count).toBe(2);
  });
  it("rejects invalid history values and retains V1 backup compatibility", () => {
    expect(validateBackup(emptyData())).toEqual(emptyData());
    expect(() =>
      validateBackup({
        ...emptyData(),
        frequent: [
          {
            id: "x",
            name: "Milk",
            quantity: "",
            count: -1,
            lastPurchased: "2026-11-06",
          },
        ],
      }),
    ).toThrow();
  });
});

it("upgrades a real V1 IndexedDB fixture without changing its original kitchen", async () => {
  const name = "eatfirst-legacy-upgrade-fixture";
  await Dexie.delete(name);
  const legacy = new Dexie(name);
  legacy.version(1).stores({ state: "id" });
  const original = { ...emptyData(), foods: [f()] };
  await legacy.table("state").put({ id: "main", data: original });
  legacy.close();
  const upgraded = new EatFirstDB(name);
  await upgraded.open();
  expect((await upgraded.state.get("main"))?.data).toEqual(original);
  expect(await upgraded.caches.count()).toBe(0);
  expect(await upgraded.backups.count()).toBe(0);
  upgraded.close();
  await Dexie.delete(name);
});

describe("network cancellation keeps offline edits responsive", () => {
  it("aborts an in-flight cloud request as soon as connectivity is lost", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (_input, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Offline", "AbortError")),
        ),
      );
    try {
      const { cloudFetch, abortCloudRequests } =
        await import("../src/family/network");
      const result = cloudFetch("https://example.invalid");
      abortCloudRequests();
      await expect(result).rejects.toMatchObject({ name: "AbortError" });
    } finally {
      globalThis.fetch = original;
    }
  });
});
