import Dexie, { type Table } from "dexie";
import { emptyData, validateBackup, type Data } from "./core";
class EatFirstDB extends Dexie {
  state!: Table<{ id: string; data: Data }, string>;
  caches!: Table<{ id: string; value: unknown }, string>;
  backups!: Table<
    { id: string; label: string; date: string; data: Data },
    string
  >;
  constructor() {
    super("eatfirst");
    this.version(1).stores({ state: "id" });
    this.version(2).stores({ state: "id", caches: "id", backups: "id,date" });
  }
}
export const db = new EatFirstDB();
export async function readData() {
  const row = await db.state.get("main");
  return row ? validateBackup(row.data) : emptyData();
}
export async function saveData(data: Data) {
  await db.state.put({ id: "main", data: validateBackup(data) });
}

export async function preserveBackup(data: Data, label: string) {
  const id = crypto.randomUUID();
  await db.backups.put({
    id,
    label,
    date: new Date().toISOString(),
    data: validateBackup(data),
  });
  return id;
}
