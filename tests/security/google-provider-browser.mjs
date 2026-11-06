/* global process, console, URL */
import { mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const base =
  process.env.EATFIRST_URL ??
  "https://amaijulianson-source.github.io/EatFirst/v2-preview/";
await mkdir("test-results/google-hosted", { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let state, authorize;
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname === "/auth/v1/authorize") authorize = u;
    if (u.hostname === "accounts.google.com" && u.searchParams.has("state"))
      state = u.searchParams.get("state");
  });
  await page.goto(`${base}#Family`);
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  if (base.includes("/v2-preview/"))
    await expect(
      page.getByText("V2 verification preview", { exact: true }),
    ).toBeVisible();
  await page.screenshot({
    path: "test-results/google-hosted/public-preview-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.waitForURL("https://accounts.google.com/**");
  await expect.poll(() => Boolean(state)).toBe(true);
  assert.equal(authorize.searchParams.get("redirect_to"), base);
  assert.equal(authorize.searchParams.get("code_challenge_method"), "s256");
  assert.equal(authorize.searchParams.get("provider"), "google");
  const body = await page.locator("body").innerText();
  assert(
    !/invalid_client|redirect_uri_mismatch|Access blocked|Error 400|Error 401/i.test(
      body,
    ),
  );
  assert.match(body, /Sign in|Choose an account/i);
  const callback = new URL("/auth/v1/callback", authorize.origin);
  callback.searchParams.set("state", state);
  callback.searchParams.set("error", "access_denied");
  callback.searchParams.set(
    "error_description",
    "User cancelled verification probe",
  );
  await page.goto(callback.href);
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  assert(page.url().startsWith(base));
  await expect(page.getByRole("alert")).toContainText(
    /cancelled|could not finish/,
  );
  assert(!new URL(page.url()).searchParams.has("code"));
  assert(!page.url().includes("error_description"));
  console.log(
    JSON.stringify(
      {
        publicPreview: "passed",
        googleHandoff: "valid sign-in screen",
        exactRedirect: "passed",
        pkce: "S256",
        hostedProviderCancellation:
          "returned to preview Family with readable error",
        googleAccountLogin: "not performed; human account chooser required",
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
