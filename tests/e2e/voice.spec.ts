import { test, expect, type Page } from "@playwright/test";
declare global {
  interface Window {
    __voiceTest: {
      emit: (results: [string, boolean][]) => void;
      end: () => void;
      error: (error: string) => void;
      aborted: number;
      stopped: number;
    };
  }
}
async function mockSpeech(page: Page) {
  await page.addInitScript(() => {
    let current: Engine;
    class Engine {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onaudioend: (() => void) | null = null;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      constructor() {
        // Store the active injected test engine so tests can send real API-shaped events.
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        current = this;
      }
      start() {
        this.onstart?.();
      }
      stop() {
        window.__voiceTest.stopped++;
        this.onend?.();
      }
      abort() {
        window.__voiceTest.aborted++;
      }
    }
    Object.defineProperty(window, "SpeechRecognition", {
      value: Engine,
      configurable: true,
    });
    window.__voiceTest = {
      emit(results) {
        current.onresult?.({
          resultIndex: 0,
          results: results.map(([transcript, isFinal]) => ({
            isFinal,
            length: 1,
            0: { transcript },
          })),
        });
      },
      end() {
        current.onend?.();
      },
      error(error) {
        current.onerror?.({ error });
      },
      aborted: 0,
      stopped: 0,
    };
  });
}
async function enter(page: Page) {
  await page.goto("./#Inventory");
  await page
    .getByRole("button", { name: "Add food", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Import from photos", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Scan expiry dates", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Talk to EatFirst", exact: true })
    .click();
  await expect(page.getByLabel("Your words", { exact: true })).toBeVisible();
}
async function ack(page: Page) {
  const box = page.getByRole("checkbox", {
    name: "I’ve checked uncertain names, amounts, dates and references.",
  });
  if (await box.isVisible()) await box.check();
}
test("segmented speech preserves long pauses, interim corrections and microphone end recovery", async ({
  page,
}) => {
  await mockSpeech(page);
  await enter(page);
  const micBox = await page.locator(".voice-mic").boundingBox(),
    statusBox = await page
      .getByRole("dialog")
      .getByRole("status")
      .boundingBox(),
    footerBox = await page.locator(".voice-flow .entry-confirm").boundingBox();
  expect(
    micBox &&
      statusBox &&
      footerBox &&
      Math.max(micBox.y + micBox.height, statusBox.y + statusBox.height) <=
        footerBox.y,
  ).toBe(true);
  await page.clock.install();
  await page
    .getByRole("button", { name: "Start or resume listening", exact: true })
    .click();
  await page.evaluate(() =>
    window.__voiceTest.emit([
      ["seven eggs", true],
      ["two tomatoes", false],
    ]),
  );
  await expect(page.locator(".voice-detected li")).toHaveCount(1);
  await expect(page.getByText("Hearing: two tomatoes")).toBeVisible();
  await page.clock.fastForward(15000);
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Listening",
  );
  await page.evaluate(() =>
    window.__voiceTest.emit([
      ["seven eggs", true],
      ["two tomatoes", true],
    ]),
  );
  await page.evaluate(() => window.__voiceTest.end());
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Microphone off",
  );
  await page
    .getByRole("button", { name: "Start or resume listening", exact: true })
    .click();
  await page.evaluate(() =>
    window.__voiceTest.emit([["actually make it four", true]]),
  );
  await expect(page.locator(".voice-detected li").last()).toContainText(
    "4 pieces",
  );
  await page
    .getByRole("button", { name: "Finish & review", exact: true })
    .click();
  await expect(page.locator(".voice-review-card")).toHaveCount(2);
  expect(await page.evaluate(() => window.__voiceTest.stopped)).toBeGreaterThan(
    0,
  );
  await page
    .getByRole("button", { name: "Confirm inventory changes", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Tomatoes 4 pieces/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Eggs 7 pieces/ }),
  ).toBeVisible();
});
test("natural text fallback, private draft restoration, correction and offline confirmation", async ({
  page,
  context,
}, info) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      configurable: true,
    });
  });
  await enter(page);
  await expect(
    page.getByRole("button", { name: "Start or resume listening" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Use keyboard dictation below", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Your words", { exact: true })
    .fill(
      "Ik heb zeven eieren, twee pakken melk en een beetje kaas. Er is bijna geen ketchup meer. Twee tomaten. Eigenlijk vier.",
    );
  await expect(page.locator(".voice-detected li")).toHaveCount(5);
  await expect(page.locator(".food-row")).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await enter(page);
  await expect(page.getByLabel("Your words", { exact: true })).toHaveValue(
    /zeven eieren/,
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await enter(page);
  await page
    .getByRole("button", { name: "Finish & review", exact: true })
    .click();
  await expect(page.locator(".voice-review-card")).toHaveCount(5);
  const ketchup = page.locator(".voice-review-card").filter({
    has: page
      .getByRole("textbox", { name: "Item name", exact: true })
      .and(page.locator('input[value="Ketchup"]')),
  });
  await ketchup
    .getByRole("checkbox", { name: "Also add Ketchup to the shopping list" })
    .check();
  await ack(page);
  await page.screenshot({
    path: `test-results/voice-review-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Confirm inventory changes", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Milk 2 carton/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Cheese Quantity unspecified/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Ketchup Low stock Quantity unspecified/,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".food-row")).toHaveCount(5);
  await page.goto("./#Shopping");
  await expect(page.getByLabel("Edit Ketchup", { exact: true })).toBeVisible();
  await context.setOffline(false);
  await enter(page);
  await expect(page.getByLabel("Your words", { exact: true })).toHaveValue("");
});
test("stock checks reconcile totals; purchases remain separate; review edits and unknown dates persist", async ({
  page,
}) => {
  await enter(page);
  await page.getByLabel("Your words", { exact: true }).fill("Seven eggs");
  await page
    .getByRole("button", { name: "Finish & review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm inventory changes", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await enter(page);
  await page
    .getByLabel("Your words", { exact: true })
    .fill("I have seven eggs. Some cheese that's good until tomorrow.");
  await page
    .getByRole("button", { name: "Finish & review", exact: true })
    .click();
  await expect(
    page
      .locator(".voice-review-card")
      .first()
      .getByText("No quantity change", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".voice-review-card")
    .last()
    .getByLabel("Quantity (leave blank if unknown)")
    .fill("200");
  await page
    .locator(".voice-review-card")
    .last()
    .getByRole("combobox", { name: "Unit", exact: true })
    .selectOption("g");
  await ack(page);
  await page
    .getByRole("button", { name: "Confirm inventory changes", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".food-row")).toHaveCount(2);
  await page.getByRole("button", { name: /Cheese 200 g/ }).click();
  await expect(
    page.getByRole("combobox", { name: "Date on the package" }),
  ).toHaveValue("unknown");
  await page
    .getByRole("checkbox", { name: "Low stock / nearly empty" })
    .check();
  await page.getByRole("button", { name: "Save food", exact: true }).click();
  await enter(page);
  await page
    .getByRole("combobox", { name: "Inventory mode", exact: true })
    .selectOption("purchase");
  await page
    .getByLabel("Your words", { exact: true })
    .fill("I bought seven eggs");
  await page
    .getByRole("button", { name: "Finish & review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm inventory changes", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".food-row")).toHaveCount(3);
});
test("speech errors and cancellation stop listening and leave inventory unchanged", async ({
  page,
}) => {
  await mockSpeech(page);
  await enter(page);
  await page.getByRole("button", { name: "Start or resume listening" }).click();
  await page.evaluate(() =>
    window.__voiceTest.emit([
      ["seven eggs", true],
      ["some cheese", false],
    ]),
  );
  await page.evaluate(() => window.__voiceTest.error("network"));
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Microphone off",
  );
  await expect(
    page.getByText(/speech service lost its connection/),
  ).toBeVisible();
  await expect(
    page.getByText("Last phrase needs a check", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Keep last phrase", exact: true })
    .click();
  await expect(page.getByLabel("Your words", { exact: true })).toHaveValue(
    /some cheese/,
  );
  await page.getByRole("button", { name: "Start or resume listening" }).click();
  await page
    .getByRole("button", { name: "Cancel session", exact: true })
    .click();
  expect(
    await page.evaluate(() => window.__voiceTest.aborted),
  ).toBeGreaterThanOrEqual(2);
  await expect(page.locator(".food-row")).toHaveCount(0);
  await enter(page);
  await expect(page.getByLabel("Your words", { exact: true })).toHaveValue("");
});
test("review removal, missing-item editing and inventory action choices stay explicit", async ({
  page,
}) => {
  await enter(page);
  await page
    .getByLabel("Your words", { exact: true })
    .fill("Seven eggs and two tomatoes");
  await page
    .getByRole("button", { name: "Finish & review", exact: true })
    .click();
  await page.getByRole("button", { name: "Remove voice item 2" }).click();
  await page
    .getByRole("button", { name: "Add a missing item", exact: true })
    .click();
  const last = page.locator(".voice-review-card").last();
  await last.getByLabel("Item name", { exact: true }).fill("Ketchup");
  await last.getByLabel("Inventory action").selectOption("new");
  await ack(page);
  await page
    .getByRole("button", { name: "Confirm inventory changes", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".food-row")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("restored voice checks use current inventory when rebuilding the review", async ({
  page,
}) => {
  await enter(page);
  await page.getByLabel("Your words", { exact: true }).fill("Seven eggs");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("button", { name: "Add food", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Quick add", exact: true }).click();
  await page.getByLabel("Food name", { exact: true }).fill("Eggs");
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Save food", exact: true }).click();
  await enter(page);
  await expect(page.getByLabel("Your words", { exact: true })).toHaveValue(
    "Seven eggs",
  );
  await page
    .getByRole("button", { name: "Finish & review", exact: true })
    .click();
  await expect(
    page
      .locator(".voice-review-card")
      .getByText("Replace the existing total; never add it twice", {
        exact: true,
      }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm inventory changes", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".food-row")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /Eggs 7 pieces/ }),
  ).toBeVisible();
});
