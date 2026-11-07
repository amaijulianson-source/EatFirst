import { db } from "../db";
import {
  categories,
  locations,
  validDate,
  validateBackup,
  type Data,
} from "../core";
import type { VoiceReview } from "./reconcile";
import type { VoiceMode } from "./interpret";
export type VoiceDraft = {
  version: 1;
  text: string;
  pending: string;
  mode: VoiceMode;
  language: "en-GB" | "nl-NL";
  timeZone: string;
  phase: "capture" | "review";
  rows: VoiceReview[];
  baseline: Data;
  resolvedDate: string;
};
export function validateVoiceDraft(value: unknown): VoiceDraft {
  const fail = () => {
    throw Error(
      "This voice draft could not be restored. Inventory is unchanged.",
    );
  };
  if (!value || typeof value !== "object") return fail();
  const d = value as VoiceDraft;
  if (
    d.version !== 1 ||
    typeof d.text !== "string" ||
    d.text.length > 18000 ||
    typeof d.pending !== "string" ||
    d.pending.length > 4000 ||
    !["check", "purchase", "consume"].includes(d.mode) ||
    !["en-GB", "nl-NL"].includes(d.language) ||
    !["capture", "review"].includes(d.phase) ||
    typeof d.timeZone !== "string" ||
    !validDate(d.resolvedDate) ||
    !Array.isArray(d.rows) ||
    d.rows.length > 100
  )
    return fail();
  try {
    new Intl.DateTimeFormat("en", { timeZone: d.timeZone });
  } catch {
    return fail();
  }
  for (const r of d.rows) {
    if (
      !r ||
      typeof r.id !== "string" ||
      typeof r.newId !== "string" ||
      typeof r.name !== "string" ||
      r.name.length > 100 ||
      !(
        r.quantity === null ||
        (Number.isFinite(r.quantity) && r.quantity > 0 && r.quantity <= 1000000)
      ) ||
      typeof r.unit !== "string" ||
      r.unit.length > 30 ||
      !categories.includes(r.category) ||
      !locations.includes(r.location) ||
      typeof r.expiry !== "string" ||
      (r.expiry !== "" && !validDate(r.expiry)) ||
      !["use-by", "best-before", "unknown"].includes(r.dateType) ||
      !(r.lowStock === null || typeof r.lowStock === "boolean") ||
      typeof r.locationSpoken !== "boolean" ||
      typeof r.expirySpoken !== "boolean" ||
      !Array.isArray(r.warnings) ||
      r.warnings.length > 50 ||
      !r.warnings.every((s) => typeof s === "string" && s.length < 1000) ||
      !["new", "replace", "increase", "choose", "consume"].includes(r.action) ||
      typeof r.targetId !== "string" ||
      typeof r.included !== "boolean" ||
      typeof r.addToShopping !== "boolean"
    )
      return fail();
  }
  for (const r of d.rows) {
    if (
      r.intent !== undefined &&
      !["check", "purchase", "consume"].includes(r.intent)
    )
      return fail();
    if (
      r.consumption !== undefined &&
      (!r.consumption ||
        !["used", "eaten", "discarded"].includes(r.consumption.kind) ||
        !["exact", "half", "all", "unclear"].includes(r.consumption.amount) ||
        (r.consumption.last !== undefined &&
          typeof r.consumption.last !== "boolean"))
    )
      return fail();
    if (
      r.action === "consume" &&
      (!r.consumption || !Array.isArray(r.allocations))
    )
      return fail();
    if (
      r.allocations !== undefined &&
      (!Array.isArray(r.allocations) ||
        r.allocations.length > 100 ||
        r.allocations.some(
          (a) =>
            !a ||
            typeof a.id !== "string" ||
            typeof a.whole !== "boolean" ||
            !(
              a.amount === null ||
              (Number.isFinite(a.amount) && a.amount > 0 && a.amount <= 1000000)
            ),
        ))
    )
      return fail();
  }
  return { ...d, baseline: validateBackup(d.baseline) };
}
const key = (identity: string) => `voice:${identity}:draft`;
export async function readVoiceDraft(identity: string) {
  const row = await db.caches.get(key(identity));
  return row ? validateVoiceDraft(row.value) : null;
}
export async function storeVoiceDraft(identity: string, draft: VoiceDraft) {
  await db.caches.put({ id: key(identity), value: validateVoiceDraft(draft) });
}
export async function clearVoiceDraft(identity: string) {
  await db.caches.delete(key(identity));
}
