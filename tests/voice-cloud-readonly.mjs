/* global process, console, fetch */
import assert from "node:assert/strict";
import { chromium } from "playwright";
const base =
  process.env.EATFIRST_URL ??
  "https://amaijulianson-source.github.io/EatFirst/";
const url = process.env.VITE_SUPABASE_URL,
  key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert(
  url && key,
  "Supply existing public frontend connection details; no secret/service key.",
);
assert(
  key.startsWith("sb_publishable_"),
  "This probe only uses the public publishable key.",
);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(base);
  const result = await page.evaluate(
    async ({ url, key }) => {
      const headers = { apikey: key };
      const settings = await fetch(
        `${url.replace(/\/$/, "")}/auth/v1/settings`,
        { headers },
      );
      const auth = await settings.json();
      const tables = {};
      for (const table of [
        "inventory_items",
        "shopping_items",
        "household_members",
        "household_invitations",
      ]) {
        const response = await fetch(
          `${url.replace(/\/$/, "")}/rest/v1/${table}?select=*&limit=1`,
          { headers },
        );
        const data = await response.json();
        tables[table] = {
          status: response.status,
          exposedRecords: Array.isArray(data) ? data.length : 0,
        };
      }
      return {
        authSettingsStatus: settings.status,
        googleEnabled: auth.external?.google,
        tables,
      };
    },
    { url, key },
  );
  assert.equal(result.authSettingsStatus, 200);
  assert.equal(result.googleEnabled, true);
  for (const [table, r] of Object.entries(result.tables)) {
    assert([200, 401, 403].includes(r.status), `Unexpected ${table} status`);
    assert.equal(r.exposedRecords, 0, `Anonymous ${table} exposure`);
  }
  console.log(
    JSON.stringify(
      {
        ...result,
        mutations: "none",
        authenticatedCrossHouseholdIsolation:
          "tested in disposable local policy/RPC suite, not real family accounts",
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
