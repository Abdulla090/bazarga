import { expect, test } from "@playwright/test";

/**
 * Seller-created variants: a new seller adds Size (S/M/L) × Colour (2) from the product form, sets stock for all and
 * one price, saves; the storefront shows the pickers with per-variant price and sold-out state; the edit page
 * re-opens with every combination intact. Also checks the editor at 360 px in Kurdish (RTL): no sideways scroll.
 */
const ownIp = (baseURL) => (/localhost|127\.0\.0\.1/.test(baseURL) ? { "x-forwarded-for": `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } : {});

async function sellerWithStore(browser, baseURL, { locale = "en", width = 1280 } = {}) {
  const host = new URL(baseURL).hostname;
  const tag = `${Date.now()}${Math.floor(Math.random() * 1e4)}`;
  const ctx = await browser.newContext({ viewport: { width, height: 860 }, extraHTTPHeaders: ownIp(baseURL) });
  await ctx.addCookies([{ name: "mm_locale", value: locale, domain: host, path: "/" }]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/signup", { waitUntil: "networkidle" });
  await page.locator('input[name="name"] >> visible=true').fill("Audit Variant Seller");
  await page.locator('input[name="email"] >> visible=true').fill(`audit-${tag}@example.com`);
  await page.locator('input[name="password"] >> visible=true').fill("audit-variant-pass-123");
  await page.locator("form button >> visible=true").last().click();
  await page.waitForURL("**/onboarding**", { timeout: 30_000 });
  const slug = `audit-${tag}`.slice(0, 30);
  await page.goto("/onboarding", { waitUntil: "networkidle" });
  await page.locator('input[name="name"] >> visible=true').fill(`Audit Variants ${tag}`);
  await page.locator('input[name="slug"] >> visible=true').fill(slug);
  await page.locator('input[name="whatsapp"] >> visible=true').fill("0750 123 4567");
  await page.locator("form button.btn-gold >> visible=true").click();
  await page.waitForURL(/\/(dashboard|onboarding\?step=theme)/, { timeout: 30_000 });
  return { ctx, page, slug, tag, errors, host };
}

async function addValues(option, text) {
  await option.getByTestId("option-value-input").fill(text);
  await option.getByTestId("option-value-input").press("Enter");
}

test("seller creates sizes × colours with their own price and stock; shoppers pick them", async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  const { ctx, page, slug, tag, errors, host } = await sellerWithStore(browser, baseURL);
  const name = `Audit Variant Tee ${tag}`;
  await page.goto("/dashboard/products/new", { waitUntil: "networkidle" });
  await page.locator('input[name="name.en"]').fill(name);
  await page.locator('input[name="price"]').fill("20000");

  await page.getByTestId("add-option-size").click();
  const size = page.getByTestId("variant-option").nth(0);
  await addValues(size, "S, M, L");
  await expect(page.getByTestId("variant-row")).toHaveCount(3);
  // product-level stock/SKU make way for per-variant ones
  await expect(page.locator('input[name="stock"]')).toHaveCount(0);
  await expect(page.getByTestId("variants-stock-note")).toBeVisible();

  await page.getByTestId("add-option-colour").click();
  const colour = page.getByTestId("variant-option").nth(1);
  await addValues(colour, "Red");
  await addValues(colour, "Blue");
  await expect(page.getByTestId("variant-row")).toHaveCount(6);

  // stock 4 for all, then L / Blue costs more and S / Red is sold out
  await page.getByLabel("Stock for all").fill("4");
  await page.getByTestId("variant-apply-all").click();
  const rows = page.getByTestId("variant-row");
  await rows.nth(5).getByLabel("Price").fill("26000"); // L / Blue
  await rows.nth(0).getByLabel("Stock").fill("0"); // S / Red
  await rows.nth(0).getByLabel("SKU").fill("TEE-S-RED");
  await expect(rows.nth(5).getByLabel("Stock")).toHaveValue("4");

  await page.locator("form button.btn-gold").click();
  await page.waitForURL((u) => u.pathname === "/dashboard/products", { timeout: 30_000 });

  // edit page re-opens with every combination intact
  await page.getByRole("link", { name }).first().click();
  await page.waitForURL("**/dashboard/products/**");
  await expect(page.getByTestId("variant-row")).toHaveCount(6);
  await expect(page.getByTestId("variant-row").nth(0).getByLabel("SKU")).toHaveValue("TEE-S-RED");
  await expect(page.getByTestId("variant-row").nth(5).getByLabel("Price")).toHaveValue("26000");

  // shopper
  const shopper = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await shopper.addCookies([{ name: "mm_locale", value: "en", domain: host, path: "/" }]);
  const sp = await shopper.newPage();
  await sp.goto(`/s/${slug}`, { waitUntil: "networkidle" });
  await sp.getByRole("link", { name }).first().click();
  await sp.waitForURL(`**/s/${slug}/p/**`);
  await sp.getByRole("button", { name: "L", exact: true }).click();
  await sp.getByRole("button", { name: "Blue", exact: true }).click();
  await expect(sp.getByTestId("price")).toContainText("26");
  await sp.getByRole("button", { name: "S", exact: true }).click();
  // Red in S is sold out → shown, but not buyable
  await expect(sp.getByRole("button", { name: /Red · / })).toBeDisabled();
  await sp.getByTestId("buy-add").click();
  await sp.goto(`/s/${slug}/cart`, { waitUntil: "networkidle" });
  await expect(sp.getByTestId("cart-lines")).toContainText("S / Blue");
  expect(errors).toEqual([]);
  await shopper.close();
  await ctx.close();
});

test("variant editor fits 360 px in Kurdish (RTL) and keeps 44 px targets", async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const { ctx, page } = await sellerWithStore(browser, baseURL, { locale: "ku", width: 360 });
  await page.goto("/dashboard/products/new", { waitUntil: "networkidle" });
  await page.getByTestId("add-option-size").click();
  await addValues(page.getByTestId("variant-option").nth(0), "S, M, XL");
  await page.getByTestId("add-option-colour").click();
  await addValues(page.getByTestId("variant-option").nth(1), "سوور, شین");
  await expect(page.getByTestId("variant-row")).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const small = await page.getByTestId("variants-editor").locator("button, input[type=checkbox]").evaluateAll((els) =>
    els
      .map((el) => {
        const t = el.closest("label") ?? el;
        const r = t.getBoundingClientRect();
        return { h: r.height, w: r.width, text: el.getAttribute("aria-label") ?? el.textContent };
      })
      .filter((r) => r.h > 0 && (r.h < 44 || r.w < 44)),
  );
  expect(small).toEqual([]);
  await page.screenshot({ path: "test-results/variants-editor-ku-360.png", fullPage: true });
  await ctx.close();
});
