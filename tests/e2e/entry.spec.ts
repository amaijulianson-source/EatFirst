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
test("finish a shopping trip atomically with dates in the editable review", async ({
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
  await milk.getByLabel("Expiry date (optional)").fill("2099-11-12");
  await d
    .getByRole("button", { name: "Confirm & save 2 items", exact: true })
    .click();
  await expect(
    d.getByRole("heading", { name: "Your groceries are in." }),
  ).toBeVisible();
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
