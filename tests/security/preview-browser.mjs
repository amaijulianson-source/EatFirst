/* global process, console, localStorage, indexedDB, navigator */
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
const root = process.env.EATFIRST_ROOT_URL;
assert(root, "Set EATFIRST_ROOT_URL to a combined V1/preview build");
const preview = `${root}v2-preview/`;
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(root);
  await page
    .getByRole("button", { name: "Add food", exact: true })
    .first()
    .click();
  await page.getByLabel("Food name").fill("V1 preservation probe");
  await page.getByRole("button", { name: "Save food", exact: true }).click();
  const original = await page.evaluate(async () => {
    localStorage.setItem("eatfirst-invite", "b".repeat(64));
    localStorage.setItem(
      "sb-mbcfjavjmboyongdmowb-auth-token",
      "original-auth-marker",
    );
    const databases = await indexedDB.databases();
    return databases.find((d) => d.name === "eatfirst");
  });
  assert(original);
  // Control the next navigation with the live worker: it must exclude preview.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.goto(`${preview}?invite=${"a".repeat(64)}`);
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await expect(
    page.getByText("V2 verification preview", { exact: true }),
  ).toBeVisible();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("eatfirst-preview-invite")),
    "a".repeat(64),
  );
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await expect(
    page.getByText("V1 preservation probe", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add food", exact: true })
    .first()
    .click();
  await page.getByLabel("Food name").fill("Preview apple");
  await page.getByRole("button", { name: "Save food", exact: true }).click();
  const after = await page.evaluate(async () => {
    const databases = await indexedDB.databases();
    return {
      original: databases.find((d) => d.name === "eatfirst"),
      preview: databases.find((d) => d.name === "eatfirst-v2-preview"),
      invite: localStorage.getItem("eatfirst-invite"),
      auth: localStorage.getItem("sb-mbcfjavjmboyongdmowb-auth-token"),
    };
  });
  assert.deepEqual(after.original, original);
  assert(after.preview);
  assert.equal(after.invite, "b".repeat(64));
  assert.equal(after.auth, "original-auth-marker");
  await page.goto(root);
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await expect(
    page.getByText("V1 preservation probe", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Preview apple", { exact: true })).toHaveCount(0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: live worker routes preview correctly; V1 database version/data/auth/invite untouched; preview groceries isolated; V1 remains usable.",
  );
} finally {
  await browser.close();
}
