/* global console, navigator, fetch, window, Event */
import { readFileSync } from "node:fs";
import { browserFetch } from "./hosted-transport.mjs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
const config = JSON.parse(readFileSync(".env.hosted-test.local", "utf8"));
const browser = await chromium.launch();
const transport = await browser.newPage();
await transport.goto("https://amaijulianson-source.github.io/EatFirst/");
const backend = config.url,
  base = "http://127.0.0.1:4181/";
const password = config.password,
  suffix = randomUUID().slice(0, 8),
  houseName = `EatFirst V2 verification browser ${suffix}`;
const options = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: browserFetch(transport) },
};
const owner = createClient(backend, config.key, options),
  member = createClient(backend, config.key, options);
const accounts = [
  { client: owner, email: config.emails[0], name: "Owner" },
  { client: member, email: config.emails[1], name: "Member" },
];
for (const a of accounts) {
  const { error } = await a.client.auth.signInWithPassword({
    email: a.email,
    password,
  });
  assert.equal(error, null);
}

try {
  const ca = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    cb = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const a = await ca.newPage(),
    b = await cb.newPage();
  const realtime = { owner: 0, member: 0 };
  for (const [page, name] of [
    [a, "owner"],
    [b, "member"],
  ])
    page.on("websocket", (ws) =>
      ws.on("framereceived", (frame) => {
        try {
          const packet = JSON.parse(frame.payload.toString());
          if (
            (Array.isArray(packet) ? packet[3] : packet.event) ===
            "postgres_changes"
          )
            realtime[name]++;
        } catch {
          /* Other frames are ignored. */
        }
      }),
    );
  const errors = [];
  for (const page of [a, b])
    page.on("pageerror", (err) => errors.push(err.message));
  // Seed real V1-style local data through the existing UI before opting into cloud.
  await a.goto(base);
  await a.getByRole("button", { name: "Add food", exact: true }).click();
  await a.getByRole("button", { name: "Quick add", exact: true }).click();
  await a.getByLabel("Food name").fill("Bananas");
  await a.getByRole("button", { name: "Save food", exact: true }).click();
  async function login(page, account) {
    await page.goto(`${base}#Family`);
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByText(account.email, { exact: true }).waitFor();
  }
  await login(a, accounts[0]);
  await login(b, accounts[1]);
  const createForm = a.locator("form").filter({
    has: a.getByRole("button", { name: "Create household", exact: true }),
  });
  await createForm.getByLabel("Household name").fill(houseName);
  await createForm.getByLabel("Your display name").fill("Owner");
  await createForm
    .getByRole("button", { name: "Create household", exact: true })
    .click();
  await a.getByRole("heading", { name: houseName, exact: true }).waitFor();
  const house = (
    await owner.from("households").select("id").eq("name", houseName)
  ).data[0].id;
  await a.getByRole("button", { name: "Review local migration" }).click();
  await a.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect
    .poll(async () => {
      const r = await owner.rpc("household_snapshot", { h: house });
      return r.data?.foods.length;
    })
    .toBe(1);
  await a
    .getByLabel("Restrict to email (recommended, optional)")
    .fill(accounts[1].email);
  await a.getByRole("button", { name: "Create invitation link" }).click();
  const link = await a.getByLabel("Share this private link").inputValue();
  await b.goto(link);
  const joinForm = b.locator("form").filter({
    has: b.getByRole("button", { name: "Accept invitation", exact: true }),
  });
  await joinForm.getByLabel("Your display name").fill("Member");
  await joinForm
    .getByRole("button", { name: "Accept invitation", exact: true })
    .click();
  await b.getByRole("heading", { name: houseName, exact: true }).waitFor();
  await a.goto(`${base}#Inventory`);
  await a.getByRole("button", { name: "Add food", exact: true }).click();
  await a.getByRole("button", { name: "Quick add", exact: true }).click();
  await a.getByLabel("Food name").fill("Milk");
  await a.getByRole("button", { name: "Save food", exact: true }).click();
  await expect
    .poll(async () => {
      const r = await owner.rpc("household_snapshot", { h: house });
      return r.data?.foods.some((f) => f.name === "Milk");
    })
    .toBe(true);
  await b.goto(`${base}#Inventory`);
  await expect(b.getByRole("button", { name: /Milk 1 pieces/ })).toBeVisible();
  // Disconnect a real browser; queue a new item and reload from the PWA cache.
  await b.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await b.reload();
  await expect(b.getByRole("button", { name: /Milk 1 pieces/ })).toBeVisible();
  await cb.setOffline(true);
  await b.getByRole("button", { name: "Add food", exact: true }).click();
  await b.getByRole("button", { name: "Quick add", exact: true }).click();
  await b.getByLabel("Food name").fill("Eggs");
  await b.getByRole("button", { name: "Save food", exact: true }).click();
  await expect(b.getByRole("button", { name: /Eggs 1 pieces/ })).toBeVisible();
  await b.reload();
  await expect(b.getByRole("button", { name: /Eggs 1 pieces/ })).toBeVisible();
  await cb.setOffline(false);
  await expect
    .poll(
      async () => {
        const r = await member.rpc("household_snapshot", { h: house });
        return r.data?.foods.some((f) => f.name === "Eggs");
      },
      { timeout: 20000 },
    )
    .toBe(true);
  await expect(a.getByRole("button", { name: /Eggs 1 pieces/ }), {
    timeout: 15000,
  }).toBeVisible();
  await b.goto(`${base}#Shopping`);
  await b.getByLabel("Shopping item name").fill("Bread");
  await b.getByLabel("New shopping item quantity").fill("1 loaf");
  await b.getByRole("button", { name: "Add to list" }).click();
  await expect
    .poll(async () => {
      const r = await owner.rpc("household_snapshot", { h: house });
      return r.data?.shopping.some((s) => s.name === "Bread");
    })
    .toBe(true);
  await a.goto(`${base}#Shopping`);
  await expect(a.getByLabel("Edit Bread", { exact: true })).toBeVisible();
  await b.getByRole("button", { name: "Start shopping mode" }).click();
  await b.getByRole("checkbox", { name: "Purchased Bread" }).check();
  await expect
    .poll(async () => {
      const r = await owner.rpc("household_snapshot", { h: house });
      return r.data?.frequent.find((f) => f.name === "Bread")?.count;
    })
    .toBe(1);
  await b.getByRole("button", { name: "Put away", exact: true }).click();
  await b.getByLabel("Expiry date (optional)").fill("2099-12-31");
  await b.getByRole("button", { name: "Save food", exact: true }).click();
  await expect
    .poll(async () => {
      const r = await owner.rpc("household_snapshot", { h: house });
      return [
        r.data?.foods.some((f) => f.name === "Bread"),
        r.data?.shopping.some((s) => s.name === "Bread"),
      ];
    })
    .toEqual([true, false]);
  // Drop one successful mutation response to simulate an interrupted acknowledgement.
  let dropped = false;
  await a.route("**/rest/v1/rpc/apply_household_changes", async (route) => {
    if (dropped) {
      await route.continue();
      return;
    }
    const req = route.request();
    const result = await transport.evaluate(
      async ({ url, headers, body }) => {
        const r = await fetch(url, { method: "POST", headers, body });
        return { status: r.status, text: await r.text() };
      },
      { url: req.url(), headers: req.headers(), body: req.postData() },
    );
    assert.equal(result.status, 200);
    dropped = true;
    await route.abort("failed");
  });
  await a.goto(`${base}#Inventory`);
  await a.getByRole("button", { name: /Milk 1 pieces/ }).click();
  await a.getByRole("button", { name: "Eaten", exact: true }).click();
  await a.getByRole("button", { name: "Confirm eaten" }).click();
  await expect.poll(() => dropped).toBe(true);
  await a.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(a.locator(".local-label")).toContainText("0 pending");
  await expect
    .poll(async () => {
      const r = await owner.rpc("household_snapshot", { h: house });
      return r.data?.events.filter(
        (e) => e.food.name === "Milk" && e.action === "eaten",
      ).length;
    })
    .toBe(1);
  await a.unroute("**/rest/v1/rpc/apply_household_changes");
  // Two disconnected phones consume the same food. Only one operation may win.
  await a.goto(`${base}#Inventory`);
  await b.goto(`${base}#Inventory`);
  await expect(a.getByRole("button", { name: /Bread 1 pieces/ })).toBeVisible();
  await expect(b.getByRole("button", { name: /Bread 1 pieces/ })).toBeVisible();
  await ca.setOffline(true);
  await cb.setOffline(true);
  for (const page of [a, b]) {
    await page.getByRole("button", { name: /Bread 1 pieces/ }).click();
    await page.getByRole("button", { name: "Eaten", exact: true }).click();
    await page.getByRole("button", { name: "Confirm eaten" }).click();
  }
  await ca.setOffline(false);
  await expect
    .poll(async () => {
      const r = await owner.rpc("household_snapshot", { h: house });
      return r.data?.events.filter(
        (e) => e.food.name === "Bread" && e.action === "eaten",
      ).length;
    })
    .toBe(1);
  await cb.setOffline(false);
  await b.goto(`${base}#Family`);
  await expect(
    b.getByRole("heading", { name: "Two people edited the same record" }),
  ).toBeVisible({ timeout: 15000 });
  await b
    .getByRole("button", { name: "Keep shared version & preserve proposal" })
    .click();
  await b.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    b.getByText(
      "Conflict proposal — preserved before returning to shared version",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(b.locator(".local-label")).toContainText("0 pending");
  const finalSnapshot = await owner.rpc("household_snapshot", { h: house });
  assert.equal(
    finalSnapshot.data.events.filter(
      (e) => e.food.name === "Bread" && e.action === "eaten",
    ).length,
    1,
  );
  await a.goto(`${base}#Family`);
  await a.getByRole("button", { name: "Sign out", exact: true }).click();
  await a.goto(`${base}#Inventory`);
  await expect(
    a.getByRole("button", { name: /Bananas 1 pieces/ }),
  ).toBeVisible();
  await expect(a.getByRole("button", { name: /Milk 1 pieces/ })).toHaveCount(0);
  assert.deepEqual(errors, []);
  assert(
    realtime.owner > 0 && realtime.member > 0,
    `Expected postgres_changes on both browsers: ${JSON.stringify(realtime)}`,
  );
  await a.screenshot({
    path: "artifacts/v2-hosted-preserved-local-mobile.png",
    fullPage: true,
  });
  await b.screenshot({
    path: "artifacts/v2-hosted-shopping-mode-mobile.png",
    fullPage: true,
  });
  console.log(
    JSON.stringify(
      {
        browserAccounts: "two actual hosted Supabase Auth users",
        householdAndInvitation: "passed",
        confirmedLocalMigration: "passed",
        localDataAfterLogout: "preserved",
        crossDeviceInventoryAndShopping: "passed via real Supabase realtime",
        offlineQueueReloadReconnect: "passed",
        frequentlyBought: "passed",
        atomicShoppingTransfer: "passed",
        pageErrors: errors,
        realtimeWebsocket: realtime,
        lostAcknowledgement: "retried once without duplicate consumption",
        offlineConflict:
          "one winner, other proposal archived before resolution",
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  for (const a of accounts) await a.client.auth.signOut();
}
