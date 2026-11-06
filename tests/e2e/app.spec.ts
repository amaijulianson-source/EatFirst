import { test, expect } from "@playwright/test";
test("daily kitchen flow, persistence, waste and shopping", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Good food, better days." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add food", exact: true }).click();
  await page.getByRole("button", { name: "Quick add", exact: true }).click();
  await page.getByLabel("Food name").fill("Eggs");
  await page.getByLabel("Quantity", { exact: true }).fill("6");
  await page.getByLabel("Expiry date (optional)").fill("2099-12-31");
  await page.getByRole("button", { name: "Save food", exact: true }).click();
  const nav =
    info.project.name === "mobile"
      ? page.getByRole("navigation", { name: "Mobile navigation" })
      : page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("button", { name: /Inventory/ }).click();
  await expect(
    page.getByRole("button", { name: /Eggs 6 pieces/ }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Eggs 6 pieces/ }).click();
  await page.getByLabel("Food name").fill("Organic eggs");
  await page.getByRole("button", { name: "Save food", exact: true }).click();
  await page.getByRole("button", { name: /Organic eggs 6 pieces/ }).click();
  await page.getByRole("button", { name: "Eaten", exact: true }).click();
  await page.getByLabel("Amount (pieces)").fill("2");
  await page.getByRole("button", { name: "Confirm eaten" }).click();
  await expect(
    page.getByRole("button", { name: /Organic eggs 4 pieces/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Organic eggs 4 pieces/ }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await page.getByRole("button", { name: "Confirm discarded" }).click();
  await nav.getByRole("button", { name: "Waste", exact: true }).click();
  await expect(page.getByText("Organic eggs", { exact: true })).toBeVisible();
  await nav.getByRole("button", { name: "Shopping", exact: true }).click();
  await page.getByLabel("Shopping item name").fill("Tomatoes");
  await page.getByRole("button", { name: "Add to list" }).click();
  await page.getByRole("checkbox", { name: "Purchased Tomatoes" }).check();
  await page.getByRole("button", { name: "Put away", exact: true }).click();
  await page.getByLabel("Expiry date (optional)").fill("2099-12-31");
  await page.getByRole("button", { name: "Save food", exact: true }).click();
  await expect(page.getByLabel("Edit Tomatoes", { exact: true })).toHaveCount(
    0,
  );
  await nav.getByRole("button", { name: /Inventory/ }).click();
  await expect(
    page.getByRole("button", { name: /Tomatoes 1 pieces/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Tomatoes 1 pieces/ }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your kitchen starts here" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("recipes, settings, backup and offline shell", async ({
  page,
  context,
}, info) => {
  await page.goto("./#Settings");
  await page.getByRole("button", { name: "Try sample kitchen" }).click();
  await expect(page.getByText(/Sample data mode/)).toBeVisible();
  const nav =
    info.project.name === "mobile"
      ? page.getByRole("navigation", { name: "Mobile navigation" })
      : page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("button", { name: "Recipes", exact: true }).click();
  await page
    .getByRole("button", { name: "Discover recipes", exact: true })
    .click();
  await page
    .getByLabel("Search recipes or ingredients")
    .fill("Garden omelette");
  await page.getByRole("button", { name: /Garden omelette/ }).click();
  await expect(page.getByRole("heading", { name: "Let’s cook" })).toBeVisible();
  await page
    .getByRole("button", { name: "Add missing ingredients to shopping" })
    .click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("./#Settings");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON backup" }).click();
  expect((await download).suggestedFilename()).toContain("eatfirst-backup");
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":8}'),
  });
  await expect(page.getByRole("alert")).toContainText("Invalid backup");
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page.getByLabel("Appearance").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your kitchen, your way." }),
  ).toBeVisible();
  await context.setOffline(false);
  await page.screenshot({
    path: `test-results/${info.project.name}-settings.png`,
    fullPage: true,
  });
});
test("quick multi-add, filters, confirmed restore and cooking deduction", async ({
  page,
}, info) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Add food", exact: true }).click();
  await page.getByRole("button", { name: "Quick add", exact: true }).click();
  await page.getByLabel("Food name").fill("Tomatoes");
  await page.getByRole("button", { name: "Save & add another" }).click();
  await expect(page.getByLabel("Food name")).toHaveValue("");
  await page.getByLabel("Food name").fill("Bread");
  await page.getByRole("button", { name: "Save food", exact: true }).click();
  const nav =
    info.project.name === "mobile"
      ? page.getByRole("navigation", { name: "Mobile navigation" })
      : page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("button", { name: /Inventory/ }).click();
  await page.getByLabel("Search inventory").fill("Bread");
  await expect(page.locator(".food-row")).toHaveCount(1);
  await page.getByLabel("Search inventory").fill("");
  await page
    .getByRole("combobox", { name: "Expiry", exact: true })
    .selectOption("No date");
  await expect(page.locator(".food-row")).toHaveCount(2);
  await nav.getByRole("button", { name: "Recipes", exact: true }).click();
  await page
    .getByRole("button", { name: "Discover recipes", exact: true })
    .click();
  await page.getByLabel("Search recipes or ingredients").fill("Tomato toast");
  await page.getByRole("button", { name: /Tomato toast/ }).click();
  await page
    .getByRole("button", { name: "Cooked it? Update your inventory" })
    .click();
  await page.getByLabel("Tomatoes (pieces, 1 available)").fill("1");
  await page.getByRole("button", { name: "Confirm quantities used" }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("./#Settings");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON backup" }).click();
  const file = await (await download).path();
  await page
    .getByRole("button", { name: "Delete all data", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles(file!);
  await expect(
    page.getByRole("heading", { name: "Replace your kitchen?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Replace & restore" }).click();
  await nav.getByRole("button", { name: /Inventory/ }).click();
  await expect(
    page.getByRole("button", { name: /Bread 1 pieces/ }),
  ).toBeVisible();
  await expect(page.locator(".food-row")).toHaveCount(1);
  await page.goto("./#Shopping");
  await page.getByLabel("Shopping item name").fill("Onion");
  await page.getByRole("button", { name: "Add to list" }).click();
  await page.getByLabel("Edit Onion", { exact: true }).fill("Red onion");
  await page.getByRole("heading", { level: 1 }).click();
  await expect(
    page.getByLabel("Edit Red onion", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Quantity for Red onion").fill("2 pieces");
  await page.getByRole("heading", { level: 1 }).click();
  await expect(
    page.getByLabel("Edit Red onion", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".local-label")).toHaveText("Saved on this device");
  await page.reload();
  await expect(page.getByLabel("Quantity for Red onion")).toHaveValue(
    "2 pieces",
  );
  await page
    .getByRole("button", { name: "Remove Red onion from shopping list" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Room for the essentials" }),
  ).toBeVisible();
});
