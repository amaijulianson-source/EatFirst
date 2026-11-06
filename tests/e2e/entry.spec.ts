import { test, expect, type Page } from "@playwright/test";
import { emptyData } from "../../src/core";
async function enter(page: Page, method: string) {
  await page.goto("./");
  await page.getByRole("button", { name: "Add food", exact: true }).click();
  await page.getByRole("button", { name: method, exact: true }).click();
}
async function seedShopping(page: Page) {
  const d = emptyData();
  d.shopping = [
    { id: "milk", name: "Milk", quantity: "1 litre", checked: true },
    { id: "pasta", name: "Spaghetti", quantity: "500 g", checked: true },
    { id: "bread", name: "Bread", quantity: "1 loaf", checked: false },
  ];
  await page.goto("./#Settings");
  await page.locator("input[type=file]").setInputFiles({
    name: "trip.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(d)),
  });
  await page
    .getByRole("button", { name: "Replace & restore", exact: true })
    .click();
  await page.goto("./#Shopping");
}
test("quick add normalizes Dutch labels, remembers packages and never reuses expiry", async ({
  page,
}) => {
  await enter(page, "Quick add");
  const d = page.getByRole("dialog");
  await d.getByLabel("Food name", { exact: true }).fill("AH halfvolle melk 1L");
  await expect(d.getByLabel("Quantity", { exact: true })).toHaveValue("1");
  await expect(
    d.getByRole("combobox", { name: "Unit", exact: true }),
  ).toHaveValue("litre");
  await d.getByLabel("Expiry date (optional)").fill("2099-11-09");
  await d.getByRole("button", { name: "Save food", exact: true }).click();
  await page.goto("./#Inventory");
  await expect(
    page.getByRole("button", { name: /Milk \(semi-skimmed\) 1 litre/ }),
  ).toBeVisible();
  await enter(page, "Quick add");
  await d
    .getByRole("button", { name: "Milk (semi-skimmed)", exact: true })
    .click();
  await expect(
    d.getByRole("combobox", { name: "Unit", exact: true }),
  ).toHaveValue("litre");
  await expect(d.getByLabel("Expiry date (optional)")).toHaveValue("");
  await d.getByRole("button", { name: "Save food", exact: true }).click();
  await page.goto("./#Inventory");
  await expect(page.locator(".food-row")).toHaveCount(2);
});
test("finish a shopping trip atomically and assign confirmed dates afterward", async ({
  page,
}) => {
  await seedShopping(page);
  await page
    .getByRole("button", { name: /Add purchased items to inventory/ })
    .click();
  const d = page.getByRole("dialog");
  await d
    .getByRole("button", { name: "Review purchased items (2)", exact: true })
    .click();
  await expect(d.locator(".draft-card")).toHaveCount(2);
  const milk = d.locator(".draft-card").first();
  await milk.getByLabel("Quantity", { exact: true }).fill("2");
  await d
    .getByRole("button", { name: "Confirm & save 2 items", exact: true })
    .click();
  await expect(
    d.getByRole("heading", { name: "Your groceries are in." }),
  ).toBeVisible();
  await d
    .getByRole("button", { name: "Scan dates for these items", exact: true })
    .click();
  await d
    .getByText("Review or paste recognized label text", { exact: true })
    .click();
  await d.getByLabel("Label or receipt text").fill("USE BY 2099-11-12");
  await d
    .getByRole("button", { name: "Read pasted text", exact: true })
    .click();
  await d
    .getByRole("combobox", { name: "Match inventory item", exact: true })
    .selectOption({ label: "Milk · 2 litre · Fridge" });
  await d
    .getByRole("checkbox", { name: "Apply this date", exact: true })
    .check();
  await d
    .getByRole("button", { name: "Save confirmed dates", exact: true })
    .click();
  await expect(d.getByRole("status")).toContainText("Confirmed dates saved");
  await d.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("./#Inventory");
  await expect(
    page.getByRole("button", { name: /Milk 2 litre/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Pasta 500 g/ })).toBeVisible();
  await page.goto("./#Shopping");
  await expect(page.getByLabel("Edit Bread", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Edit Milk", { exact: true })).toHaveCount(0);
});
test("real multi-photo OCR, draft persistence and offline OCR after preparation", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page, "Import from photos");
  let d = page.getByRole("dialog");
  await d
    .getByLabel("Choose multiple photos")
    .setInputFiles([
      "tests/fixtures/entry/milk-label.png",
      "tests/fixtures/entry/receipt.png",
    ]);
  await expect(
    d.getByRole("heading", { name: "Review 3 groceries", exact: true }),
  )
    .toBeVisible({ timeout: 90000 })
    .catch(async (error: unknown) => {
      console.error("Multi-photo review state:", await d.innerText());
      console.error("Browser errors:", errors);
      throw error;
    });
  await expect(d.getByLabel("Item name", { exact: true })).toHaveCount(3);
  await expect(d.getByLabel("Item name", { exact: true }).first()).toHaveValue(
    "Milk (semi-skimmed)",
  );
  await page.reload();
  await page.getByRole("button", { name: "Add food", exact: true }).click();
  await page
    .getByRole("button", { name: "Import from photos", exact: true })
    .click();
  d = page.getByRole("dialog");
  await expect(
    d.getByRole("heading", { name: "Review 3 groceries", exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await d
    .getByLabel("Choose multiple photos")
    .setInputFiles(["tests/fixtures/entry/yogurt-date.png"]);
  await expect(
    d.getByRole("heading", { name: "Review 4 groceries", exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await expect(d.getByLabel("Item name", { exact: true }).last()).toHaveValue(
    "Yogurt",
  );
  await d
    .getByRole("button", { name: "Confirm & save 4 items", exact: true })
    .click();
  await expect(
    d.getByRole("heading", { name: "Your groceries are in." }),
  ).toBeVisible();
  await d.getByRole("button", { name: "Done", exact: true }).click();
  await page.goto("./#Inventory");
  await expect(page.locator(".food-row")).toHaveCount(4);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("actual barcode photo and opt-in lookup remain editable before saving", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.route(
    "https://world.openfoodfacts.org/api/v2/product/**",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: 1,
          product: {
            product_name_nl: "AH halfvolle melk",
            quantity: "1L",
            brands: "Fixture",
          },
        }),
      }),
  );
  await enter(page, "Import from photos");
  const d = page.getByRole("dialog");
  await d
    .getByLabel("Choose multiple photos")
    .setInputFiles("tests/fixtures/entry/barcode.png");
  await expect(d.locator(".barcode-review")).toContainText("4006381333931", {
    timeout: 90000,
  });
  await d
    .getByRole("button", { name: "Look up barcode online", exact: true })
    .click();
  await expect(d.getByLabel("Item name", { exact: true })).toHaveValue(
    "Milk (semi-skimmed)",
  );
  await d.getByLabel("Quantity", { exact: true }).fill("2");
  await d
    .getByRole("button", { name: "Confirm & save 1 items", exact: true })
    .click();
  await expect(
    d.getByRole("heading", { name: "Your groceries are in." }),
  ).toBeVisible();
  await d.getByRole("button", { name: "Done", exact: true }).click();
  await page.goto("./#Inventory");
  await expect(
    page.getByRole("button", { name: /Milk \(semi-skimmed\) 2 litre/ }),
  ).toBeVisible();
});
test("date-only photo is matched explicitly and a draft can be corrected or removed", async ({
  page,
}) => {
  test.setTimeout(120000);
  await enter(page, "Import from photos");
  const d = page.getByRole("dialog");
  await d
    .getByRole("button", { name: "Add an item manually", exact: true })
    .click();
  await d.getByLabel("Item name", { exact: true }).fill("Apples");
  await d
    .getByLabel("Choose multiple photos")
    .setInputFiles("tests/fixtures/entry/date-only.png");
  const candidate = d.locator(".photo-date-candidates .date-review").first();
  await expect(candidate).toBeVisible({ timeout: 90000 });
  await candidate
    .getByRole("combobox", { name: "Review item for this date" })
    .selectOption({ label: "Apples" });
  await candidate
    .getByRole("button", { name: "Confirm date for this draft", exact: true })
    .click();
  await expect(
    d.locator(".draft-card").getByLabel("Expiry date (optional)"),
  ).toHaveValue("2026-11-12");
  await d.getByRole("button", { name: "Remove draft 1", exact: true }).click();
  await expect(d.locator(".draft-card")).toHaveCount(0);
  await d.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("./#Inventory");
  await expect(
    page.getByRole("heading", { name: "Your kitchen starts here" }),
  ).toBeVisible();
});
test.describe("cancellation during a paused tool download", () => {
  // A service worker can satisfy this request before Playwright's route sees it.
  // Other tests exercise the real worker/offline path. This isolates cancellation.
  test.use({ serviceWorkers: "block" });
  test("cancelling photo analysis leaves inventory unchanged", async ({
    page,
  }) => {
    let release!: () => void;
    let requested = false;
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/ocr/v1/core.wasm.js", async (route) => {
      requested = true;
      await paused;
      await route.continue().catch(() => undefined);
    });
    try {
      await enter(page, "Import from photos");
      const d = page.getByRole("dialog");
      await d
        .getByLabel("Choose multiple photos")
        .setInputFiles("tests/fixtures/entry/milk-label.png");
      await expect.poll(() => requested, { timeout: 15000 }).toBe(true);
      await expect(
        d.getByRole("button", { name: "Stop reading", exact: true }),
      ).toBeVisible();
      await d
        .getByRole("button", { name: "Stop reading", exact: true })
        .click();
      await expect(d.getByRole("status")).toContainText("Reading stopped");
      await d.getByRole("button", { name: "Close dialog" }).click();
      await page.goto("./#Inventory");
      await expect(
        page.getByRole("heading", { name: "Your kitchen starts here" }),
      ).toBeVisible();
    } finally {
      release();
    }
  });
});
