import { test, expect, type Page } from "@playwright/test";
import { emptyData, type Food } from "../../src/core";
async function seed(page: Page) {
  const d = emptyData();
  const entries: [string, number, string][] = [
    ["Tomatoes", 10, "pieces"],
    ["Eggs", 6, "pieces"],
    ["Cheese", 200, "g"],
    ["Olive oil", 300, "ml"],
    ["Pasta", 500, "g"],
    ["Bananas", 5, "pieces"],
    ["Milk", 2, "carton"],
  ];
  d.foods = entries.map(
    ([name, quantity, unit]) =>
      ({
        id: name,
        name,
        quantity,
        unit,
        category:
          name === "Cheese" || name === "Milk" || name === "Eggs"
            ? "Dairy"
            : "Produce",
        location: "Fridge",
        added: "2026-11-07",
        expiry: "2099-11-10",
        dateType: "best-before",
        notes: "",
      }) as Food,
  );
  await page.goto("./#Settings");
  await page.locator('input[type="file"]').setInputFiles({
    name: "cooking.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(d)),
  });
  await page
    .getByRole("button", { name: "Replace & restore", exact: true })
    .click();
  await page.goto("./#Inventory");
}
async function enter(page: Page, dedicated = false) {
  await page
    .getByRole("button", { name: "Add food", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", {
      name: dedicated ? "Tell EatFirst what I used" : "Talk to EatFirst",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Your words", { exact: true })).toBeVisible();
}
async function ack(page: Page) {
  const c = page.getByRole("checkbox", {
    name: "I’ve checked uncertain names, amounts, dates and references.",
  });
  if (await c.isVisible()) await c.check();
}
async function confirm(page: Page) {
  await ack(page);
  await page
    .getByRole("button", { name: "Confirm inventory changes", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
}
test("natural cooking use needs oil clarification before atomic recipe-independent deduction", async ({
  page,
}) => {
  await seed(page);
  await enter(page);
  await page
    .getByLabel("Your words", { exact: true })
    .fill(
      "I just made pasta. I used three tomatoes, two eggs, half the cheese, and some olive oil.",
    );
  await expect(page.locator(".voice-detected li")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Finish & review", exact: true })
    .click();
  await expect(page.locator(".usage-review-card")).toHaveCount(4);
  await expect(page.locator(".voice-review-card")).toHaveCount(0);
  const oil = page
    .locator(".usage-review-card")
    .filter({ has: page.locator('input[value="Olive oil"]') });
  await ack(page);
  await expect(
    page.getByRole("button", {
      name: "Confirm inventory changes",
      exact: true,
    }),
  ).toBeDisabled();
  await oil.getByLabel("Amount from batch 1 (ml)").fill("15");
  await confirm(page);
  await expect(
    page.getByRole("button", { name: /Tomatoes 7 pieces/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Eggs 4 pieces/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Cheese 100 g/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Olive oil 285 ml/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Pasta 500 g/ })).toBeVisible();
  await expect(page.locator(".food-row")).toHaveCount(7);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Eggs 4 pieces/ }),
  ).toBeVisible();
});
test("dedicated used option, corrections, snacks and waste update appropriate records", async ({
  page,
}) => {
  await seed(page);
  await enter(page);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await enter(page, true);
  await expect(
    page.getByRole("combobox", { name: "Inventory mode", exact: true }),
  ).toHaveValue("consume");
  await page
    .getByLabel("Your words", { exact: true })
    .fill(
      "Ummm, three eggs. Actually, I used four eggs, not three. I ate two bananas. I threw away the spoiled tomatoes.",
    );
  await page
    .getByRole("button", { name: "Finish & review", exact: true })
    .click();
  await expect(page.locator(".usage-review-card")).toHaveCount(3);
  const tomatoes = page
    .locator(".usage-review-card")
    .filter({ has: page.locator('input[value="Tomatoes"]') });
  await expect(
    tomatoes.getByRole("combobox", { name: "What happened?" }),
  ).toHaveValue("discarded");
  await tomatoes
    .getByRole("button", { name: "Discard whole item", exact: true })
    .click();
  await confirm(page);
  await expect(
    page.getByRole("button", { name: /Eggs 2 pieces/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Bananas 3 pieces/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Tomatoes 10 pieces/ }),
  ).toHaveCount(0);
  await page.goto("./#Waste");
  await expect(page.getByText("Tomatoes", { exact: true })).toBeVisible();
  await expect(page.getByText("Eggs", { exact: true })).toHaveCount(0);
});
test("finishing stock, vague almost-all and cancellation never invent or silently deduct amounts", async ({
  page,
}) => {
  await seed(page);
  await enter(page);
  await page
    .getByLabel("Your words", { exact: true })
    .fill("We finished the milk. I used almost all the pasta.");
  await page
    .getByRole("button", { name: "Finish & review", exact: true })
    .click();
  const pasta = page
    .locator(".usage-review-card")
    .filter({ has: page.locator('input[value="Pasta"]') });
  await expect(pasta.getByLabel("Amount from batch 1 (g)")).toHaveValue("");
  await ack(page);
  await expect(
    page.getByRole("button", {
      name: "Confirm inventory changes",
      exact: true,
    }),
  ).toBeDisabled();
  await pasta.getByLabel("Amount from batch 1 (g)").fill("450");
  await page
    .getByRole("button", { name: "Cancel session", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Milk 2 carton/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Pasta 500 g/ })).toBeVisible();
  await enter(page);
  await page
    .getByLabel("Your words", { exact: true })
    .fill("We finished the milk");
  await page
    .getByRole("button", { name: "Finish & review", exact: true })
    .click();
  await confirm(page);
  await expect(page.getByRole("button", { name: /Milk 2 carton/ })).toHaveCount(
    0,
  );
});
test("offline cooking deductions survive reload without duplicate application", async ({
  page,
  context,
}) => {
  await seed(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await enter(page);
  await page
    .getByLabel("Your words", { exact: true })
    .fill("Ik heb drie tomaten en twee eieren gebruikt.");
  await page
    .getByRole("button", { name: "Finish & review", exact: true })
    .click();
  await confirm(page);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Eggs 4 pieces/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Tomatoes 7 pieces/ }),
  ).toBeVisible();
  await context.setOffline(false);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Eggs 4 pieces/ }),
  ).toBeVisible();
});

test("a missed cooking ingredient can be added to review without creating inventory", async ({
  page,
}) => {
  await seed(page);
  await enter(page);
  await page.getByLabel("Your words", { exact: true }).fill("I used two eggs");
  await page
    .getByRole("button", { name: "Finish & review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add a missing item", exact: true })
    .click();
  await expect(page.locator(".usage-review-card")).toHaveCount(2);
  const row = page.locator(".usage-review-card").last();
  await row.getByLabel("Ingredient name", { exact: true }).fill("Cheese");
  await row.getByLabel("Ingredient name", { exact: true }).blur();
  await row.getByLabel("Amount from batch 1 (g)").fill("75");
  await confirm(page);
  await expect(
    page.getByRole("button", { name: /Cheese 125 g/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Eggs 4 pieces/ }),
  ).toBeVisible();
  await expect(page.locator(".food-row")).toHaveCount(7);
});
