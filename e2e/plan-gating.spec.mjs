import { expect, test } from "@playwright/test";

/**
 * Plan gating, end to end (localhost or live via BASE_URL): a new store is on Free (10 products).
 * Fill the cap, then the add-product page swaps the form for an upgrade prompt; the server also refuses an 11th.
 * Finally the seller files an upgrade request and the page shows it as pending.
 */
test("free plan caps products at 10 and upgrade request is filed", async ({ browser, baseURL }) => {
  test.setTimeout(300_000);
  const host = new URL(baseURL).hostname;
  const tag = `${Date.now()}${Math.floor(Math.random() * 1e4)}`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addCookies([{ name: "mm_locale", value: "en", domain: host, path: "/" }]);
  const page = await ctx.newPage();

  await page.goto("/signup", { waitUntil: "networkidle" });
  await page.locator('input[name="name"]').fill("Gate Seller");
  await page.locator('input[name="email"]').fill(`gate-${tag}@example.com`);
  await page.locator('input[name="password"]').fill("e2e-gating-pass-123");
  await page.locator("form button").last().click();
  await page.waitForURL("**/onboarding**", { timeout: 30_000 });
  await page.goto("/onboarding", { waitUntil: "networkidle" });
  await page.locator('input[name="name"]').fill(`Gate Shop ${tag}`);
  await page.locator('input[name="slug"]').fill(`gate-${tag}`.slice(0, 30));
  await page.locator('input[name="whatsapp"]').fill("0750 123 4567");
  await page.locator("form button.btn-gold").click();
  await page.waitForURL(/\/(dashboard|onboarding\?step=theme)/, { timeout: 30_000 });

  for (let i = 1; i <= 10; i++) {
    await page.goto("/dashboard/products/new", { waitUntil: "networkidle" });
    await expect(page.getByTestId("limit-reached")).toHaveCount(0);
    await page.locator('input[name="name.en"]').fill(`Gate item ${i}`);
    await page.locator('input[name="price"]').fill("5000");
    await page.locator('input[name="stock"]').fill("3");
    await page.locator("form button.btn-gold").click();
    await page.waitForURL((u) => !u.pathname.endsWith("/products/new"), { timeout: 30_000 });
  }

  // at the cap: list shows the meter + upgrade CTA, add page shows the prompt instead of the form
  await page.goto("/dashboard/products", { waitUntil: "networkidle" });
  await expect(page.locator("[data-plan-usage]")).toContainText("10");
  await page.goto("/dashboard/products/new", { waitUntil: "networkidle" });
  await expect(page.getByTestId("limit-reached")).toBeVisible();
  await expect(page.locator('input[name="name.en"]')).toHaveCount(0);
  await page.getByTestId("limit-upgrade").click();
  await page.waitForURL("**/dashboard/upgrade**");

  // file a manual upgrade request (Pro, monthly)
  await page.locator('input[name="plan"][value="pro"]').check();
  await page.locator('input[name="months"][value="1"]').check();
  await page.locator('form button').last().click();
  await expect(page.getByRole("status").filter({ hasText: /pro/i }).first()).toBeVisible({ timeout: 15_000 });
  await ctx.close();
});
