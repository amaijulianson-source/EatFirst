/* global console, fetch, localStorage, URL */
import { Buffer } from "node:buffer";
import { randomUUID, createHmac } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:4182/",
  backend = "http://127.0.0.1:54330";
const e = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const p = `${e({ alg: "HS256", typ: "JWT" })}.${e({ role: "anon", iss: "supabase", iat: 1700000000, exp: 2200000000 })}`;
const key = `${p}.${createHmac("sha256", "eatfirst-local-testing-jwt-secret-at-least-32-chars").update(p).digest("base64url")}`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  const token = "a".repeat(64);
  await page.goto(`${base}?invite=${token}`);
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await expect(page.getByText(/An invitation is waiting/)).toBeVisible();
  assert.equal(await page.getByLabel("Password", { exact: true }).count(), 0);
  let authorize;
  // Check the real SDK-generated OAuth request. Do not pretend to log in to Google.
  await page.route("**/auth/v1/authorize?**", (route) => {
    authorize = new URL(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "OAuth request captured for contract testing",
    });
  });
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect.poll(() => Boolean(authorize)).toBe(true);
  assert.equal(authorize.searchParams.get("provider"), "google");
  assert.equal(authorize.searchParams.get("redirect_to"), base);
  assert.equal(authorize.searchParams.get("prompt"), "select_account");
  assert.equal(authorize.searchParams.get("code_challenge_method"), "s256");
  assert.match(authorize.searchParams.get("code_challenge"), /^[\w-]{43}$/);
  await page.goto(
    `${base}#error=access_denied&error_description=private-detail`,
  );
  await expect(page.getByRole("alert")).toContainText("cancelled or denied");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("eatfirst-invite")),
    token,
  );
  assert(!page.url().includes("private-detail"));
  // Exercise the same real GoTrue PKCE callback/session exchange used by OAuth,
  // using a local email fixture. External Google consent remains a separate release gate.
  const storage = new Map();
  const client = createClient(backend, key, {
    auth: {
      flowType: "pkce",
      autoRefreshToken: false,
      storage: {
        getItem: (k) => storage.get(k) ?? null,
        setItem: (k, v) => storage.set(k, v),
        removeItem: (k) => storage.delete(k),
      },
    },
  });
  const email = `callback-${randomUUID().slice(0, 8)}@eatfirst.test`;
  const signup = await client.auth.signUp({
    email,
    password: `Fixture-${randomUUID()}`,
    options: {
      emailRedirectTo: base,
      data: { full_name: "Google-style Profile" },
    },
  });
  assert.equal(signup.error, null);
  await page.goto(base);
  await page.evaluate(
    (entries) => {
      for (const [k, v] of entries) localStorage.setItem(k, v);
    },
    [...storage.entries()],
  );
  let id;
  await expect
    .poll(
      async () => {
        const result = await (
          await fetch("http://127.0.0.1:54327/api/v1/messages")
        ).json();
        id = result.messages.find((m) =>
          m.To.some((a) => a.Address === email),
        )?.ID;
        return Boolean(id);
      },
      { timeout: 15000 },
    )
    .toBe(true);
  const mail = await (
    await fetch(`http://127.0.0.1:54327/api/v1/message/${id}`)
  ).json();
  const link = (mail.Text || mail.HTML)
    .match(/http:\/\/127\.0\.0\.1:54330[^\s"<>]+/)?.[0]
    ?.replaceAll("&amp;", "&");
  assert(link);
  await page.goto(link);
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await expect(page.getByLabel("Your display name").first()).toHaveValue(
    "Google-style Profile",
  );
  await page.reload();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Google OAuth request/PKCE contract, cancellation, retained invite, real GoTrue callback, session persistence, metadata, logout. External Google consent NOT tested.",
  );
} finally {
  await browser.close();
}
