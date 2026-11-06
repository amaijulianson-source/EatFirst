/* global console, fetch */
import { randomUUID } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:4182/",
  email = `confirmation-${randomUUID().slice(0, 8)}@eatfirst.test`,
  password = `Account-test-${randomUUID()}`,
  changed = `Changed-test-${randomUUID()}`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}#Family`);
  await page.getByRole("tab", { name: "Create account", exact: true }).click();
  await page
    .getByLabel("Your display name", { exact: true })
    .fill("Confirmed owner");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText(/Check your email to confirm your account/),
  ).toBeVisible();
  const seen = new Set();
  async function mailLink() {
    let id;
    await expect
      .poll(
        async () => {
          const response = await fetch(
            "http://127.0.0.1:54327/api/v1/messages",
          );
          const data = await response.json();
          const found = data.messages.find(
            (m) => m.To.some((a) => a.Address === email) && !seen.has(m.ID),
          );
          id = found?.ID;
          return !!id;
        },
        { timeout: 12000 },
      )
      .toBe(true);
    seen.add(id);
    const response = await fetch(`http://127.0.0.1:54327/api/v1/message/${id}`);
    const message = await response.json();
    const link = (message.Text || message.HTML)
      .match(/http:\/\/127\.0\.0\.1:54330[^\s"<>]+/)?.[0]
      ?.replaceAll("&amp;", "&");
    assert(link, "Expected a real GoTrue confirmation link in local mail");
    return link;
  }
  await page.goto(await mailLink());
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A little more together." }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "Forgot password?", exact: true })
    .click();
  await expect(
    page.getByText(/If an account exists, a recovery email/),
  ).toBeVisible();
  await page.goto(await mailLink());
  await expect(
    page.getByRole("heading", { name: "Choose a new password" }),
  ).toBeVisible();
  await page.getByLabel("New password", { exact: true }).fill(changed);
  await page
    .getByRole("button", { name: "Update password", exact: true })
    .click();
  await expect(
    page.getByText("Password updated.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(changed);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        emailSignup: "passed with real local GoTrue and Mailpit",
        confirmationLinkAndPKCE: "passed",
        persistentSession: "passed across refresh",
        passwordRecoveryAndUpdate: "passed",
        loginWithNewPassword: "passed",
        pageErrors: errors,
        hostedSMTPDelivery: "not tested",
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
