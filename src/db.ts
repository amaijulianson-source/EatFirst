import Dexie, { type Table } from "dexie";
import { emptyData, validateBackup, type Data } from "./core";
class EatFirstDB extends Dexie {
  state!: Table<{ id: string; data: Data }, string>;
  constructor() {
    super("eatfirst");
    this.version(1).stores({ state: "id" });
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
