/* global console, window, navigator, Event */
import { Buffer } from "node:buffer";
import { createHmac, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
const e = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const p = `${e({ alg: "HS256", typ: "JWT" })}.${e({ role: "anon", iss: "supabase", iat: 1700000000, exp: 2200000000 })}`;
const anon = `${p}.${createHmac("sha256", "eatfirst-local-testing-jwt-secret-at-least-32-chars").update(p).digest("base64url")}`;
const backend = "http://127.0.0.1:54328",
  base = "http://127.0.0.1:4179/";
const password = `Browser-family-${randomUUID()}`,
  suffix = randomUUID().slice(0, 8);
const owner = createClient(backend, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  member = createClient(backend, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const accounts = [
  {
    client: owner,
    email: `browser-owner-${suffix}@eatfirst.test`,
    name: "Owner",
  },
  {
    client: member,
    email: `browser-member-${suffix}@eatfirst.test`,
    name: "Member",
  },
];
for (const a of accounts) {
  const { error } = await a.client.auth.signUp({
    email: a.email,
    password,
    options: { data: { display_name: a.name } },
  });
  assert.equal(error, null);
}
const browser = await chromium.launch();
try {
  const ca = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    cb = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const a = await ca.newPage(),
    b = await cb.newPage();
  const errors = [];
  for (const page of [a, b])
    page.on("pageerror", (err) => errors.push(err.message));
  // Seed real V1-style local data through the existing UI before opting into cloud.
  await a.goto(base);
  await a.getByRole("button", { name: "Add food", exact: true }).click();
  await a.getByLabel("Food name").fill("Legacy banana");
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
  await createForm.getByLabel("Household name").fill("Browser family");
  await createForm.getByLabel("Your display name").fill("Owner");
  await createForm
    .getByRole("button", { name: "Create household", exact: true })
    .click();
  await a
    .getByRole("heading", { name: "Browser family", exact: true })
    .waitFor();
  const house = (
    await owner.from("households").select("id").eq("name", "Browser family")
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
  await b
    .getByRole("heading", { name: "Browser family", exact: true })
    .waitFor();
  await a.goto(`${base}#Inventory`);
  await a.getByRole("button", { name: "Add food", exact: true }).click();
  await a.getByLabel("Food name").fill("Shared milk");
  await a.getByRole("button", { name: "Save food", exact: true }).click();
  await expect
    .poll(async () => {
      const r = await owner.rpc("household_snapshot", { h: house });
      return r.data?.foods.some((f) => f.name === "Shared milk");
    })
    .toBe(true);
  await b.goto(`${base}#Inventory`);
  await b.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    b.getByRole("button", { name: /Shared milk 1 pieces/ }),
  ).toBeVisible();
  // Disconnect a real browser; queue a new item and reload from the PWA cache.
  await b.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await b.reload();
  await expect(
    b.getByRole("button", { name: /Shared milk 1 pieces/ }),
  ).toBeVisible();
  await cb.setOffline(true);
  await b.getByRole("button", { name: "Add food", exact: true }).click();
  await b.getByLabel("Food name").fill("Offline eggs");
  await b.getByRole("button", { name: "Save food", exact: true }).click();
  await expect(
    b.getByRole("button", { name: /Offline eggs 1 pieces/ }),
  ).toBeVisible();
  await b.reload();
  await expect(
    b.getByRole("button", { name: /Offline eggs 1 pieces/ }),
  ).toBeVisible();
  await cb.setOffline(false);
  await expect
    .poll(
      async () => {
        const r = await member.rpc("household_snapshot", { h: house });
        return r.data?.foods.some((f) => f.name === "Offline eggs");
      },
      { timeout: 20000 },
    )
    .toBe(true);
  await a.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(a.getByRole("button", { name: /Offline eggs 1 pieces/ }), {
    timeout: 15000,
  }).toBeVisible();
  await b.goto(`${base}#Shopping`);
  await b.getByLabel("Shopping item name").fill("Shared bread");
  await b.getByLabel("New shopping item quantity").fill("1 loaf");
  await b.getByRole("button", { name: "Add to list" }).click();
  await expect
    .poll(async () => {
      const r = await owner.rpc("household_snapshot", { h: house });
      return r.data?.shopping.some((s) => s.name === "Shared bread");
    })
    .toBe(true);
  await a.goto(`${base}#Shopping`);
  await a.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    a.getByLabel("Edit Shared bread", { exact: true }),
  ).toBeVisible();
  await b.getByRole("button", { name: "Start shopping mode" }).click();
  await b.getByRole("checkbox", { name: "Purchased Shared bread" }).check();
  await expect
    .poll(async () => {
      const r = await owner.rpc("household_snapshot", { h: house });
      return r.data?.frequent.find((f) => f.name === "Shared bread")?.count;
    })
    .toBe(1);
  await b.getByRole("button", { name: "Put away", exact: true }).click();
  await b.getByLabel("Expiry date (optional)").fill("2099-12-31");
  await b.getByRole("button", { name: "Save food", exact: true }).click();
  await expect
    .poll(async () => {
      const r = await owner.rpc("household_snapshot", { h: house });
      return [
        r.data?.foods.some((f) => f.name === "Shared bread"),
        r.data?.shopping.some((s) => s.name === "Shared bread"),
      ];
    })
    .toEqual([true, false]);
  await a.goto(`${base}#Family`);
  await a.getByRole("button", { name: "Sign out", exact: true }).click();
  await a.goto(`${base}#Inventory`);
  await expect(
    a.getByRole("button", { name: /Legacy banana 1 pieces/ }),
  ).toBeVisible();
  await expect(
    a.getByRole("button", { name: /Shared milk 1 pieces/ }),
  ).toHaveCount(0);
  assert.deepEqual(errors, []);
  await a.screenshot({
    path: "artifacts/v2-preserved-local-mobile.png",
    fullPage: true,
  });
  await b.screenshot({
    path: "artifacts/v2-shopping-mode-mobile.png",
    fullPage: true,
  });
  console.log(
    JSON.stringify(
      {
        browserAccounts: "two real local Auth users",
        householdAndInvitation: "passed",
        confirmedLocalMigration: "passed",
        localDataAfterLogout: "preserved",
        crossDeviceInventoryAndShopping: "passed via refetch fallback",
        offlineQueueReloadReconnect: "passed",
        frequentlyBought: "passed",
        atomicShoppingTransfer: "passed",
        pageErrors: errors,
        realtimeWebsocket: "separate verification required",
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  for (const a of accounts) await a.client.auth.signOut();
}
