import { defaults, emptyData, validateBackup, type Data } from "../core";
export type TableName =
  | "inventory_items"
  | "shopping_items"
  | "activity_events"
  | "frequent_items"
  | "settings";
export type Change = {
  table: TableName;
  key: string;
  expected: unknown;
  next: unknown;
};
export type Operation = {
  id: string;
  changes: Change[];
  created: string;
  label: string;
};
export type ScopeCache = {
  id: string;
  data: Data;
  confirmed: Data;
  queue: Operation[];
  migrated?: boolean;
  conflict?: { operation: string; table: string; key: string };
};
const lists = {
  inventory_items: "foods",
  shopping_items: "shopping",
  activity_events: "events",
  frequent_items: "frequent",
} as const;
export function canonical(v: unknown): string {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  return `{${Object.keys(v)
    .sort()
    .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
    .map(
      (k) =>
        `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`,
    )
    .join(",")}}`;
}
export function sharedSettings(d: Data) {
  return {
    staples: d.settings.staples,
    diet: d.settings.diet,
    currency: d.settings.currency,
  };
}
export function diff(before: Data, after: Data): Change[] {
  validateBackup(after);
  const changes: Change[] = [];
  for (const [table, list] of Object.entries(lists)) {
    const a = new Map(
      ((before[list as keyof typeof before] as { id: string }[]) ?? []).map(
        (v) => [v.id, v],
      ),
    );
    const b = new Map(
      ((after[list as keyof typeof after] as { id: string }[]) ?? []).map(
        (v) => [v.id, v],
      ),
    );
    for (const key of new Set([...a.keys(), ...b.keys()])) {
      const expected = a.get(key) ?? null,
        next = b.get(key) ?? null;
      if (canonical(expected) !== canonical(next))
        changes.push({ table: table as TableName, key, expected, next });
    }
  }
  if (canonical(sharedSettings(before)) !== canonical(sharedSettings(after)))
    changes.push({
      table: "settings",
      key: "settings",
      expected: sharedSettings(before),
      next: sharedSettings(after),
    });
  return changes;
}
export function overlay(
  base: Data,
  queue: Operation[],
): { data: Data; conflict?: ScopeCache["conflict"] } {
  let data = structuredClone(base);
  let conflict: ScopeCache["conflict"];
  for (const op of queue)
    for (const c of op.changes) {
      const list = c.table === "settings" ? null : lists[c.table];
      const current = list
        ? ((data[list] ?? []).find((v) => v.id === c.key) ?? null)
        : sharedSettings(data);
      if (!conflict && canonical(current) !== canonical(c.expected))
        conflict = { operation: op.id, table: c.table, key: c.key };
      if (list) {
        const values = (data[list] ?? []).filter((v) => v.id !== c.key);
        if (c.next) values.push(c.next as never);
        data = { ...data, [list]: values };
      } else
        data = {
          ...data,
          settings: { ...data.settings, ...(c.next as object) },
        };
    }
  return { data, conflict };
}
export function fromSnapshot(
  s: Record<string, unknown>,
  theme: Data["settings"]["theme"],
): Data {
  return validateBackup({
    ...emptyData(),
    foods: s.foods,
    shopping: s.shopping,
    events: s.events,
    frequent: s.frequent,
    settings: { ...defaults, ...(s.settings as object), theme },
  });
}
export function mergeLocal(current: Data, local: Data) {
  const result = structuredClone(current);
  for (const list of ["foods", "shopping", "events", "frequent"] as const) {
    const existing = new Map((result[list] ?? []).map((v) => [v.id, v]));
    for (const item of local[list] ?? []) {
      if (existing.has(item.id)) {
        if (canonical(existing.get(item.id)) !== canonical(item))
          throw Error(
            `A different ${list} record has the same ID. Resolve it before migration.`,
          );
        continue;
      }
      if (
        list === "shopping" &&
        result.shopping.some(
          (s) =>
            !s.checked &&
            s.name.trim().toLowerCase() ===
              ("name" in item ? String(item.name) : "").trim().toLowerCase(),
        )
      )
        continue;
      existing.set(item.id, item);
    }
    Object.assign(result, { [list]: [...existing.values()] });
  }
  return result;
}
