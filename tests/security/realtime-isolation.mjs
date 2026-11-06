/* global console, window, WebSocket, setInterval, clearInterval, setTimeout */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { browserFetch } from "./hosted-transport.mjs";
const config = JSON.parse(readFileSync(".env.hosted-test.local", "utf8"));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto("https://amaijulianson-source.github.io/EatFirst/");
  const options = {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: browserFetch(page) },
  };
  const owner = createClient(config.url, config.key, options),
    other = createClient(config.url, config.key, options);
  const a = await owner.auth.signInWithPassword({
      email: config.emails[0],
      password: config.password,
    }),
    c = await other.auth.signInWithPassword({
      email: config.emails[2],
      password: config.password,
    });
  assert.equal(a.error, null);
  assert.equal(c.error, null);
  const created = await owner.rpc("create_household", {
    household_name: `EatFirst V2 verification realtime ${randomUUID().slice(0, 8)}`,
    member_name: "Test owner",
  });
  assert.equal(created.error, null);
  const h = created.data;
  const joined = await page.evaluate(
    async ({ url, key, h, ownerToken, otherToken }) => {
      window.__eatfirstSecuritySockets = [];
      window.__eatfirstSecurityCounts = { owner: 0, outsider: 0 };
      async function subscribe(label, token) {
        return new Promise((resolve) => {
          const ws = new WebSocket(
            `${url.replace(/^http/, "ws")}/realtime/v1/websocket?apikey=${encodeURIComponent(key)}&vsn=1.0.0`,
          );
          const topic = `realtime:security-${label}`;
          const heartbeat = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN)
              ws.send(
                JSON.stringify({
                  topic: "phoenix",
                  event: "heartbeat",
                  payload: {},
                  ref: "heartbeat",
                }),
              );
          }, 15000);
          const timeout = setTimeout(() => resolve("timeout"), 12000);
          window.__eatfirstSecuritySockets.push({ ws, heartbeat });
          ws.onopen = () =>
            ws.send(
              JSON.stringify({
                topic,
                event: "phx_join",
                payload: {
                  config: {
                    broadcast: { self: false },
                    presence: { key: "" },
                    postgres_changes: [
                      {
                        event: "UPDATE",
                        schema: "public",
                        table: "households",
                        filter: `id=eq.${h}`,
                      },
                    ],
                  },
                  access_token: token,
                },
                ref: "join",
              }),
            );
          ws.onmessage = (e) => {
            const p = JSON.parse(e.data);
            if (p.event === "postgres_changes")
              window.__eatfirstSecurityCounts[label]++;
            if (p.event === "phx_reply" && p.ref === "join") {
              clearInterval(timeout);
              resolve(p.payload.status);
            }
          };
          ws.onerror = () => {
            clearInterval(timeout);
            resolve("error");
          };
        });
      }
      return {
        owner: await subscribe("owner", ownerToken),
        outsider: await subscribe("outsider", otherToken),
      };
    },
    {
      url: config.url,
      key: config.key,
      h,
      ownerToken: a.data.session.access_token,
      otherToken: c.data.session.access_token,
    },
  );
  assert.equal(joined.owner, "ok");
  const snapshot = await owner.rpc("household_snapshot", { h });
  assert.equal(snapshot.error, null);
  const changed = await owner.rpc("apply_household_changes", {
    h,
    operation: randomUUID(),
    changes: [
      {
        table: "settings",
        key: "settings",
        expected: snapshot.data.settings,
        next: { ...snapshot.data.settings, currency: "EUR" },
      },
    ],
  });
  assert.equal(changed.error, null);
  await expect
    .poll(() => page.evaluate(() => window.__eatfirstSecurityCounts.owner), {
      timeout: 15000,
    })
    .toBeGreaterThan(0);
  await new Promise((r) => setTimeout(r, 1500));
  const counts = await page.evaluate(() => window.__eatfirstSecurityCounts);
  assert.equal(counts.outsider, 0);
  await page.evaluate(() => {
    for (const { ws, heartbeat } of window.__eatfirstSecuritySockets) {
      clearInterval(heartbeat);
      ws.close();
    }
  });
  await owner.auth.signOut();
  await other.auth.signOut();
  console.log(
    JSON.stringify(
      {
        hostedRealtime: "passed",
        authorizedOwnerEvents: counts.owner,
        forgedHouseholdSubscriptionEvents: counts.outsider,
        outsiderJoin: joined.outsider,
        household: h,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
