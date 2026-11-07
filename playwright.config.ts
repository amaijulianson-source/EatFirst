import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results/e2e",
  fullyParallel: false,
  // Keep device projects predictable on shared CI runners.
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4175/",
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run build && npm run preview -- --port 4175",
        port: 4175,
        reuseExistingServer: false,
      },
  projects: [
    ...(process.env.EATFIRST_TEST_WEBKIT === "true"
      ? [
          {
            name: "safari",
            testMatch: ["**/voice.spec.ts", "**/consumption.spec.ts"],
            use: { ...devices["iPhone 13"] },
          },
        ]
      : []),
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});
