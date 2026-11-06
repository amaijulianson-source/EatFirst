import { db } from "../db";
import { validateBackup, type Data } from "../core";
import { validatePatterns, type Pattern, type Draft } from "./model";
export async function readPatterns(key: string): Promise<Pattern[]> {
  const row = await db.caches.get(`${key}:patterns`);
  return row ? validatePatterns(row.value) : [];
}
export async function savePatterns(key: string, patterns: Pattern[]) {
  await db.caches.put({
    id: `${key}:patterns`,
    value: validatePatterns(patterns),
  });
}
export type EntryDraft = { rows: Draft[]; baseline: Data };
export function validateDraft(value: unknown): EntryDraft {
  if (!value || typeof value !== "object") throw Error("Invalid saved draft.");
  const d = value as EntryDraft;
  if (
    !Array.isArray(d.rows) ||
    d.rows.length > 100 ||
    d.rows.some(
      (r) =>
        !r ||
        typeof r.id !== "string" ||
        typeof r.name !== "string" ||
        r.name.length > 100 ||
        !Number.isFinite(r.quantity) ||
        typeof r.unit !== "string" ||
        typeof r.notes !== "string" ||
        r.notes.length > 2000 ||
        !Array.isArray(r.review) ||
        !r.review.every((s) => typeof s === "string") ||
        !Array.isArray(r.sources) ||
        !r.sources.every((s) => typeof s === "string") ||
        typeof r.included !== "boolean" ||
        typeof r.expiry !== "string" ||
        !["manual", "shopping", "photo"].includes(r.source),
    )
  )
    throw Error("Invalid saved draft.");
  return { rows: d.rows, baseline: validateBackup(d.baseline) };
}
export async function readDraft(key: string) {
  const row = await db.caches.get(`${key}:draft`);
  return row ? validateDraft(row.value) : null;
}
export async function storeDraft(key: string, draft: EntryDraft) {
  await db.caches.put({ id: `${key}:draft`, value: validateDraft(draft) });
}
export async function clearDraft(key: string) {
  await db.caches.delete(`${key}:draft`);
}
