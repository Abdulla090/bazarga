import { expect, test } from "@playwright/test";

/**
 * Email verification (agentb/security-audit): a fresh seller sees the confirm-email banner on the dashboard,
 * can request another link, and /verify-email rejects a bogus token (the real token only ever travels by mail).
 */
test("new seller sees the verify banner, can resend, and a bogus link is rejected", async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const host = new URL(baseURL).hostname;
  const tag = `${Date.now()}${Math.floor(Math.random() * 1e4)}`;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addCookies([{ name: "mm_locale", value: "en", domain: host, path: "/" }]);
  const page = await context.newPage();

  await page.goto("/signup", { waitUntil: "networkidle" });
  await page.locator('input[name="name"]').fill("Verify Seller");
  await page.locator('input[name="email"]').fill(`verify-${tag}@example.com`);
  await page.locator('input[name="password"]').fill("verify-pass-12345");
  await page.locator("form button").last().click();
  await page.waitForURL("**/onboarding**", { timeout: 30_000 });
  await page.locator('input[name="name"]').fill(`Verify Shop ${tag}`);
  await page.locator('input[name="slug"]').fill(`vf-${tag}`.slice(0, 30));
  await page.locator('input[name="whatsapp"]').fill("0750 123 4567");
  await page.locator("form button.btn-gold").click();
  await page.waitForURL(/\/(dashboard|onboarding\?step=theme)/, { timeout: 30_000 });
  await page.goto("/dashboard", { waitUntil: "networkidle" });

  const banner = page.getByTestId("verify-banner");
  await expect(banner).toBeVisible();
  await banner.getByRole("button").click();
  await expect(banner.getByRole("status")).toBeVisible({ timeout: 15_000 });
  const sw = await page.evaluate(() => document.scrollingElement.scrollWidth);
  expect(sw).toBeLessThanOrEqual(390);

  await page.goto(`/verify-email?token=${"a".repeat(43)}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /confirm email/i }).click();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 15_000 });
  await page.goto("/verify-email", { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: /confirm email/i })).toBeDisabled();
  await context.close();
});
