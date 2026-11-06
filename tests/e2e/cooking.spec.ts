import { test, expect, type Page } from "@playwright/test";
import { emptyData, type Food } from "../../src/core";
async function seed(page: Page, amount = 300) {
  const data = emptyData();
  data.foods = [
    ["Chicken", amount, "g"],
    ["Broccoli", 350, "g"],
    ["Carrots", 300, "g"],
    ["Rice", 500, "g"],
    ["Soy sauce", 100, "ml"],
  ].map(
    ([name, quantity, unit], i) =>
      ({
        id: `cook-${i}`,
        name,
        quantity,
        unit,
        category: i === 0 ? "Meat & fish" : "Produce",
        location: "Fridge",
        added: "2026-01-01",
        expiry: "2099-01-01",
        dateType: "use-by",
        notes: "",
      }) as Food,
  );
  await page.goto("./#Settings");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "kitchen.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
  await page
    .getByRole("button", { name: "Replace & restore", exact: true })
    .click();
  await page.goto("./#Recipes");
  await expect(
    page.getByRole("heading", { name: "What’s cooking?" }),
  ).toBeVisible();
}
async function discover(page: Page, query: string) {
  await page
    .getByRole("button", { name: "Discover recipes", exact: true })
    .click();
  await page.getByLabel("Search recipes or ingredients").fill(query);
}
test("adaptive recipes, servings, favorites, confirmed cooking and local history", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page);
  await discover(page, "Chicken & broccoli & carrot rice bowl");
  await page
    .getByRole("button", { name: /Chicken & broccoli & carrot rice bowl/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Ready to cook", { exact: true }),
  ).toBeVisible();
  await dialog.getByLabel("Servings", { exact: true }).selectOption("4");
  await expect(
    dialog.getByText(/Not enough: need another 200 g/),
  ).toBeVisible();
  await dialog.getByLabel("Servings", { exact: true }).selectOption("2");
  await dialog
    .getByRole("button", { name: "Save favorite", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Saved favorite" }),
  ).toBeVisible();
  await dialog
    .getByRole("button", {
      name: "Cooked it? Update your inventory",
      exact: true,
    })
    .click();
  await dialog.getByLabel(/^Chicken \(/).fill("100");
  await dialog
    .getByRole("button", { name: "Confirm quantities used", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("Meal recorded");
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Recently cooked", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Chicken & broccoli & carrot rice bowl/ }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Chicken & broccoli & carrot rice bowl/ }),
  ).toBeVisible();
  await page.goto("./#Inventory");
  await expect(
    page.getByRole("button", { name: /Chicken 200 g/ }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("recipe shortages go to shopping once and exclusions change recommendations", async ({
  page,
}) => {
  await seed(page, 100);
  await discover(page, "Chicken & broccoli & carrot rice bowl");
  await page
    .getByRole("button", { name: /Chicken & broccoli & carrot rice bowl/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText(/Not enough: need another 150 g/),
  ).toBeVisible();
  await dialog
    .getByRole("button", {
      name: "Add missing ingredients to shopping",
      exact: true,
    })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Shopping list updated",
  );
  await dialog
    .getByRole("button", {
      name: "Add missing ingredients to shopping",
      exact: true,
    })
    .click();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("./#Shopping");
  await expect(
    page.getByLabel("Quantity for chicken", { exact: true }),
  ).toHaveValue("150 g");
  await expect(page.getByLabel("Edit chicken", { exact: true })).toHaveCount(1);
  await page.goto("./#Recipes");
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  await page
    .getByLabel("Exclude ingredients (comma separated)")
    .fill("kipfilet");
  await page
    .getByRole("button", { name: "Save exclusions", exact: true })
    .click();
  await discover(page, "chicken");
  await expect(page.locator(".cooking-card")).toHaveCount(0);
  await page.reload();
  await discover(page, "chicken");
  await expect(page.locator(".cooking-card")).toHaveCount(0);
});
test("curated photography, fallback artwork, filters and recipe memories backup", async ({
  page,
}) => {
  await page.route("**/recipes/pasta.webp", (route) => route.abort());
  await page.goto("./#Recipes");
  await discover(page, "Fresh basil pesto pasta");
  await expect(page.locator(".cooking-card")).toHaveCount(1);
  await expect(page.locator(".cooking-card .art-caption")).toBeVisible();
  await page.getByRole("button", { name: /Fresh basil pesto pasta/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Eaters Collective · CC0")).toBeVisible();
  await dialog
    .getByRole("button", { name: "Save favorite", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Saved favorite" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export recipe memories", exact: true })
    .click();
  expect((await downloaded).suggestedFilename()).toBe(
    "eatfirst-recipe-memories.json",
  );
  await page.getByLabel("Maximum time").selectOption("15");
  await page.getByLabel("Search recipes or ingredients").fill("");
  for (const time of await page.locator(".dish-time").allTextContents())
    expect(Number(time.match(/\d+/)?.[0])).toBeLessThanOrEqual(15);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
