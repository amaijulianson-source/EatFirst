/* global console */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { browserFetch } from "./hosted-transport.mjs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const config = JSON.parse(readFileSync(".env.hosted-test.local", "utf8"));
const url = config.url,
  key = config.key;
const browser = await chromium.launch();
const transport = await browser.newPage();
await transport.goto("https://amaijulianson-source.github.io/EatFirst/");
const client = () =>
  createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: browserFetch(transport) },
  });
async function rpc(c, name, args) {
  const r = await c.rpc(name, args);
  if (r.error) throw Error(`${name}: ${r.error.message}`);
  return r.data;
}
const a = client(),
  b = client(),
  c = client(),
  anon = client();
const suffix = randomUUID().slice(0, 8),
  password = config.password;
const users = [
  { c: a, email: config.emails[0] },
  { c: b, email: config.emails[1] },
  { c: c, email: config.emails[2] },
];
for (const u of users) {
  const signup = await u.c.auth.signInWithPassword({
    email: u.email,
    password,
  });
  assert.equal(signup.error, null);
  assert(signup.data.session);
  u.id = signup.data.user.id;
}
await a.auth.signOut();
const login = await a.auth.signInWithPassword({
  email: users[0].email,
  password,
});
assert.equal(login.error, null);
assert(login.data.session);
const refreshed = await a.auth.refreshSession();
assert.equal(refreshed.error, null);
assert(refreshed.data.session);
const h = await rpc(a, "create_household", {
  household_name: `EatFirst V2 verification API ${suffix}`,
  member_name: "Owner",
});
const other = await rpc(c, "create_household", {
  household_name: `EatFirst V2 verification isolated ${suffix}`,
  member_name: "Outsider",
});
assert.notEqual(h, other);
const invitation = await rpc(a, "create_invitation", {
  h,
  target_email: users[1].email,
});
const restricted = await c.rpc("accept_invitation", {
  token: invitation.token,
  member_name: "Intruder",
});
assert(restricted.error);
assert.equal(
  await rpc(b, "accept_invitation", {
    token: invitation.token,
    member_name: "Member",
  }),
  h,
);
assert(
  (
    await b.rpc("accept_invitation", {
      token: invitation.token,
      member_name: "Replay",
    })
  ).error,
);
assert((await b.rpc("create_invitation", { h, target_email: null })).error);
const row = {
  id: randomUUID(),
  name: "Shared milk",
  quantity: "1 bottle",
  checked: false,
};
const ids = [randomUUID(), randomUUID()];
const results = await Promise.all(
  [a, b].map((user, i) =>
    user.rpc("apply_household_changes", {
      h,
      operation: ids[i],
      changes: [
        {
          table: "shopping_items",
          key: row.id,
          expected: null,
          next: { ...row, quantity: `${i + 1} bottles` },
        },
      ],
    }),
  ),
);
assert(results.every((r) => !r.error));
assert.equal(results.filter((r) => r.data.conflict === true).length, 1);
const winner = results[0].data.conflict ? 1 : 0;
const duplicate = await rpc([a, b][winner], "apply_household_changes", {
  h,
  operation: ids[winner],
  changes: [
    { table: "shopping_items", key: row.id, expected: null, next: null },
  ],
});
assert.equal(duplicate.duplicate, true);
const snapshot = await rpc(b, "household_snapshot", { h });
assert.equal(snapshot.shopping.length, 1);
assert.equal(
  (await c.from("shopping_items").select("*").eq("household_id", h)).data
    .length,
  0,
);
assert((await c.rpc("household_snapshot", { h })).error);
assert(
  (
    await a
      .from("shopping_items")
      .insert({ household_id: h, id: "hack", data: row })
  ).error,
);
assert((await anon.from("shopping_items").select("*")).error);
const food = {
  id: randomUUID(),
  name: "Tomatoes",
  quantity: 2,
  unit: "pieces",
  category: "Produce",
  location: "Fridge",
  added: "2026-11-06",
  expiry: "2026-11-09",
  dateType: "best-before",
  notes: "",
};
await rpc(a, "apply_household_changes", {
  h,
  operation: randomUUID(),
  changes: [
    { table: "inventory_items", key: food.id, expected: null, next: food },
  ],
});
const event = {
  id: randomUUID(),
  food,
  amount: 1,
  action: "used",
  date: "2026-11-06",
};
const conflict = await rpc(b, "apply_household_changes", {
  h,
  operation: randomUUID(),
  changes: [
    {
      table: "inventory_items",
      key: food.id,
      expected: { ...food, quantity: 3 },
      next: { ...food, quantity: 1 },
    },
    { table: "activity_events", key: event.id, expected: null, next: event },
  ],
});
assert(conflict.conflict);
assert.equal((await rpc(a, "household_snapshot", { h })).events.length, 0);
const revoked = await rpc(a, "create_invitation", { h, target_email: null });
await rpc(a, "manage_household", { h, command: "revoke", target: revoked.id });
assert(
  (
    await c.rpc("accept_invitation", {
      token: revoked.token,
      member_name: "Revoked",
    })
  ).error,
);
assert(
  (
    await b.rpc("manage_household", {
      h,
      command: "remove",
      target: users[0].id,
    })
  ).error,
);
await rpc(a, "manage_household", { h, command: "remove", target: users[1].id });
assert((await b.rpc("household_snapshot", { h })).error);
assert.equal(
  (await b.from("shopping_items").select("*").eq("household_id", h)).data
    .length,
  0,
);
for (const u of users) await u.c.auth.signOut();
writeFileSync(
  ".env.hosted-cleanup.local",
  JSON.stringify(
    { households: [h, other], testAccounts: config.emails },
    null,
    2,
  ),
);
await browser.close();
console.log(
  JSON.stringify(
    {
      authentication:
        "hosted Supabase password login, session refresh and logout passed; test accounts pre-confirmed",
      database: "actual hosted Supabase PostgreSQL/PostgREST",
      isolation: "two households passed",
      invitations: "restricted, single-use, revoked passed",
      concurrentEdits: "one accepted; stale second rejected",
      atomicConsumption: "no partial events on conflict",
      idempotentRetries: "passed",
      ownerAndMemberRoles: "passed",
      realtime: "requires separate websocket verification",
    },
    null,
    2,
  ),
);
