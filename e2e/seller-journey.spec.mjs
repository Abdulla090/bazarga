import { expect, test } from "@playwright/test";

/**
 * Seller + shopper journey in a real browser (works against localhost or the live site via BASE_URL):
 * signup -> onboarding (create store) -> add product -> storefront shows it -> shopper adds to cart + COD order
 * -> seller sees the order in the dashboard -> upgrade page is reachable.
 */
test("seller signs up, publishes a product, a shopper orders, the seller sees it", async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  const host = new URL(baseURL).hostname;
  const tag = `${Date.now()}${Math.floor(Math.random() * 1e4)}`;
  const slug = `e2e-${tag}`.slice(0, 30);
  const productName = `E2E Linen Shirt ${tag}`;
  const seller = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await seller.addCookies([{ name: "mm_locale", value: "en", domain: host, path: "/" }]);
  const page = await seller.newPage();

  // signup
  await page.goto("/signup", { waitUntil: "networkidle" });
  await page.locator('input[name="name"]').fill("E2E Seller");
  await page.locator('input[name="email"]').fill(`e2e-${tag}@example.com`);
  await page.locator('input[name="password"]').fill("e2e-journey-pass-123");
  await page.locator("form button").last().click();
  await page.waitForURL("**/onboarding**", { timeout: 30_000 });

  // onboarding: create the store
  await page.goto("/onboarding", { waitUntil: "networkidle" });
  await page.locator('input[name="name"]').fill(`E2E Shop ${tag}`);
  await page.locator('input[name="slug"]').fill(slug);
  await page.locator('input[name="whatsapp"]').fill("0750 123 4567");
  await page.locator("form button.btn-gold").click();
  await page.waitForURL(/\/(dashboard|onboarding\?step=theme)/, { timeout: 30_000 });
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  expect(page.url()).toContain("/dashboard");

  // product
  await page.goto("/dashboard/products/new", { waitUntil: "networkidle" });
  await page.locator('input[name="name.en"]').fill(productName);
  await page.locator('input[name="price"]').fill("25000");
  await page.locator('input[name="stock"]').fill("10");
  await page.locator("form button.btn-gold").click();
  await page.waitForURL((u) => !u.pathname.endsWith("/products/new"), { timeout: 30_000 });

  // shopper
  const shopper = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await shopper.addCookies([{ name: "mm_locale", value: "en", domain: host, path: "/" }]);
  const sp = await shopper.newPage();
  await sp.goto(`/s/${slug}`, { waitUntil: "networkidle" });
  await expect(sp.getByText(productName).first()).toBeVisible();
  await sp.getByRole("link", { name: productName }).first().click();
  await sp.waitForURL(`**/s/${slug}/p/**`);
  await sp.getByTestId("buy-add").click();
  await sp.goto(`/s/${slug}/cart`, { waitUntil: "networkidle" });
  await expect(sp.getByTestId("cart-lines")).toBeVisible();
  await sp.locator('input[name="customerName"]').fill("Shopper Test");
  await sp.locator('input[name="phone"]').fill("07701234567");
  const area = sp.locator('select[name="areaId"]');
  if (await area.count()) {
    const opts = await area.locator("option").evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
    if (opts.length) await area.selectOption(opts[0]);
  }
  const city = sp.locator('select[name="city"]');
  if (await city.count()) await city.selectOption({ index: 1 }).catch(() => {});
  await sp.locator('textarea[name="address"]').fill("Test street 1");
  await sp.getByTestId("place-order").click();
  await sp.waitForURL(`**/s/${slug}/order/**`, { timeout: 30_000 });
  await expect(sp.getByTestId("track-link")).toBeVisible();
  await shopper.close();

  // seller sees the order + upgrade UI
  await page.goto("/dashboard/orders", { waitUntil: "networkidle" });
  await expect(page.getByTestId("orders-empty")).toHaveCount(0);
  await expect(page.locator('a[href^="/dashboard/orders/"]').first()).toBeVisible();
  const up = await page.goto("/dashboard/upgrade", { waitUntil: "networkidle" });
  expect(up?.status()).toBe(200);
  await seller.close();
});
