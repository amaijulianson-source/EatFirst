/* global process, console, URL, navigator, caches, location, Response, document, innerWidth */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
const url =
  process.env.EATFIRST_URL ??
  "https://amaijulianson-source.github.io/EatFirst/";
const stage = process.argv[2];
assert(
  ["seed", "verify"].includes(stage),
  "Use seed before deployment, verify afterward",
);
const profile = "/tmp/eatfirst-voice-update-profile";
await mkdir("artifacts/voice", { recursive: true });
const launch = () =>
  chromium.launchPersistentContext(profile, {
    viewport: { width: 390, height: 844 },
  });
let context = await launch();
try {
  let page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${url}#Inventory`);
  await page
    .getByRole("heading", { name: "Your kitchen, at a glance." })
    .waitFor();
  if (stage === "seed") {
    await page
      .getByRole("button", { name: "Add food", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: "Import from photos", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Quick add", exact: true }).click();
    await page
      .getByLabel("Food name", { exact: true })
      .fill("Preserved release check");
    await page.getByLabel("Quantity", { exact: true }).fill("3");
    await page.getByRole("button", { name: "Save food", exact: true }).click();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      const c = await caches.open(
        `eatfirst-ocr-${new URL("./", location.href).pathname}`,
      );
      await c.put(
        new URL("./ocr/v1/release-test", location.href),
        new Response("public old-cache test"),
      );
    });
    await page.reload();
    assert(
      await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    );
    await page.screenshot({ path: "artifacts/voice/v4-before-update.png" });
    await writeFile(
      "artifacts/voice/update-baseline.json",
      JSON.stringify(
        {
          url,
          stage,
          oldVersionPhotoButton: true,
          localGrocery: "3 pieces",
          serviceWorkerControlled: true,
          pageErrors: errors,
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS: Actual V4 service worker/profile seeded with a local-only grocery; no real household/account used.",
    );
  } else {
    // Leave the old tab open while the waiting-worker prompt appears; no skipWaiting.
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.ready;
      await r.update();
    });
    const photo = page.getByRole("button", {
      name: "Import from photos",
      exact: true,
    });
    await page
      .getByRole("button", { name: "Add food", exact: true })
      .first()
      .click();
    if (await photo.isVisible()) {
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
      await expect(page.locator("#update-note")).toBeVisible({
        timeout: 30000,
      });
      await page.screenshot({ path: "artifacts/voice/waiting-update.png" });
      await context.close();
      context = await launch();
      page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${url}#Inventory`);
      await page
        .getByRole("button", { name: "Add food", exact: true })
        .first()
        .click();
    }
    await expect(
      page.getByRole("button", { name: "Talk to EatFirst", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Import from photos", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /Preserved release check 3 pieces/ }),
    ).toBeVisible();
    const oldCache = await page.evaluate(async () =>
      (await caches.keys()).some(
        (k) => k === `eatfirst-ocr-${new URL("./", location.href).pathname}`,
      ),
    );
    assert.equal(oldCache, false);
    await context.setOffline(true);
    await page.reload();
    await expect(
      page.getByRole("button", { name: /Preserved release check 3 pieces/ }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Add food", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Talk to EatFirst", exact: true })
      .click();
    await page
      .getByLabel("Your words", { exact: true })
      .fill("Seven eggs and some cheese nearly empty");
    await expect(page.locator(".voice-detected li")).toHaveCount(2);
    await page.screenshot({ path: "artifacts/voice/offline-mobile-voice.png" });
    await page
      .getByRole("button", { name: "Finish & review", exact: true })
      .click();
    await page
      .getByRole("checkbox", {
        name: "I’ve checked uncertain names, amounts, dates and references.",
      })
      .check();
    await page
      .getByRole("button", { name: "Confirm inventory changes", exact: true })
      .click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page.reload();
    await expect(
      page.getByRole("button", { name: /Eggs 7 pieces/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: /Cheese Low stock Quantity unspecified/,
      }),
    ).toBeVisible();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    const result = {
      url,
      actualV4Upgrade: "passed without clearing storage or reinstall",
      originalLocalGrocery: "preserved",
      retiredScopedPhotoCache: "removed",
      offlineVoiceInterpretationAndConfirmation: "passed",
      offlineRefresh: "passed",
      phoneViewportOverflow: false,
      pageErrors: errors,
      physicalIPhoneSpeech: "not tested",
    };
    await writeFile(
      "artifacts/voice/update-verification.json",
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result, null, 2));
  }
} finally {
  await context.close();
}
