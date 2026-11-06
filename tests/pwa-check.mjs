/* global process, URL, navigator, document, innerWidth, console */
import assert from "node:assert/strict";
import { chromium } from "playwright";
const url = process.env.EATFIRST_URL;
assert(
  url,
  "Set EATFIRST_URL to the exact deployed HTTPS URL, including its trailing slash.",
);
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const failures = [];
  page.on("pageerror", (e) => failures.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(url);
  await page
    .getByRole("heading", { name: "Good food, better days." })
    .waitFor();
  const manifestUrl = await page
    .locator("link[rel=manifest]")
    .evaluate((e) => e.href);
  const response = await context.request.get(manifestUrl);
  assert.equal(response.status(), 200);
  const manifest = await response.json();
  const target = new URL(url);
  assert.equal(manifest.name, "EatFirst");
  assert.equal(manifest.short_name, "EatFirst");
  assert.equal(manifest.display, "standalone");
  assert.equal(new URL(manifest.scope, manifestUrl).pathname, target.pathname);
  assert.equal(
    new URL(manifest.start_url, manifestUrl).pathname,
    target.pathname,
  );
  for (const size of ["192x192", "512x512"])
    assert(manifest.icons.some((i) => i.sizes === size));
  assert(manifest.icons.some((i) => i.purpose === "maskable"));
  for (const icon of manifest.icons) {
    const asset = await context.request.get(
      new URL(icon.src, manifestUrl).href,
    );
    assert.equal(asset.status(), 200);
    assert.match(asset.headers()["content-type"], /image\/png/);
  }
  const apple = await page
    .locator("link[rel=apple-touch-icon]")
    .evaluate((e) => e.href);
  assert.equal((await context.request.get(apple)).status(), 200);
  const scope = await page.evaluate(
    async () => (await navigator.serviceWorker.ready).scope,
  );
  assert.equal(new URL(scope).pathname, target.pathname);
  await page.reload();
  assert(await page.evaluate(() => !!navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.goto(`${url}#Inventory`);
  await page
    .getByRole("heading", { name: "Your kitchen, at a glance." })
    .waitFor();
  await page.reload();
  await page
    .getByRole("heading", { name: "Your kitchen, at a glance." })
    .waitFor();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(failures, []);
  console.log(
    JSON.stringify(
      {
        url,
        manifest: manifestUrl,
        serviceWorkerScope: scope,
        icons: "passed",
        offlineLaunchAndRefresh: "passed",
        mobileOverflow: false,
        pageErrors: 0,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
