import { expect, test } from "@playwright/test";

/**
 * Abuse on the forms (docs/E2E-AUDIT.md): script/markup and SQL strings are stored and shown as plain text everywhere
 * (dashboard, storefront, order page, search), oversized input is refused with a message and nothing typed is lost,
 * and double submits create one product / one order. Test accounts are `audit-*@example.com`.
 */
const ownIp = (baseURL) => (/localhost|127\.0\.0\.1/.test(baseURL) ? { "x-forwarded-for": `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } : {});
const XSS = `<img src=x onerror="window.__pwned=1">"><script>window.__pwned=1</script>`;
const SQLI = `'; DROP TABLE products; -- ' OR '1'='1`;

async function sellerWithStore(browser, baseURL) {
  const host = new URL(baseURL).hostname;
  const tag = `${Date.now()}${Math.floor(Math.random() * 1e4)}`;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: ownIp(baseURL) });
  await ctx.addCookies([{ name: "mm_locale", value: "en", domain: host, path: "/" }]);
  const page = await ctx.newPage();
  const dialogs = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    d.dismiss().catch(() => {});
  });
  await page.goto("/signup", { waitUntil: "networkidle" });
  await page.locator('input[name="name"] >> visible=true').fill(`Audit ${XSS}`.slice(0, 80));
  await page.locator('input[name="email"] >> visible=true').fill(`audit-${tag}@example.com`);
  await page.locator('input[name="password"] >> visible=true').fill("audit-abuse-pass-123");
  await page.locator("form button >> visible=true").last().click();
  await page.waitForURL("**/onboarding**", { timeout: 30_000 });
  const slug = `audit-${tag}`.slice(0, 30);
  await page.goto("/onboarding", { waitUntil: "networkidle" });
  await page.locator('input[name="name"] >> visible=true').fill(`Shop ${SQLI}`.slice(0, 60));
  await page.locator('input[name="slug"] >> visible=true').fill(slug);
  await page.locator('input[name="whatsapp"] >> visible=true').fill("0750 123 4567");
  await page.locator("form button.btn-gold >> visible=true").click();
  await page.waitForURL(/\/(dashboard|onboarding\?step=theme)/, { timeout: 30_000 });
  return { ctx, page, slug, tag, host, dialogs };
}

test("markup and SQL strings stay text; oversized input is refused politely; double submits count once", async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  const { ctx, page, slug, tag, host, dialogs } = await sellerWithStore(browser, baseURL);
  const name = `Abuse ${tag} ${XSS}`;

  // --- product with markup in name/description/spec + variant value, saved with a double click
  await page.goto("/dashboard/products/new", { waitUntil: "networkidle" });
  await page.locator('input[name="name.en"]').fill(name);
  await page.locator('textarea[name="description.en"]').fill(`${XSS}\n${SQLI}`);
  await page.locator('input[name="price"]').fill("15000");
  await page.getByTestId("add-option-size").click();
  await page.getByTestId("option-value-input").fill(`<b>XL</b>`);
  await page.getByTestId("option-value-input").press("Enter");
  await page.locator("form button.btn-gold").dblclick();
  await page.waitForURL((u) => u.pathname === "/dashboard/products", { timeout: 30_000 });
  await page.waitForTimeout(1500); // a second submit, if any, would land now
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByText(`Abuse ${tag}`, { exact: false })).toHaveCount(1);

  // --- oversized: a 5,000-character name (maxlength bypassed) is refused with a message, nothing typed is lost
  await page.goto("/dashboard/products/new", { waitUntil: "networkidle" });
  await page.locator('input[name="name.en"]').evaluate((el) => el.removeAttribute("maxlength"));
  const huge = "Ж".repeat(5000);
  await page.locator('input[name="name.en"]').fill(huge);
  await page.locator('input[name="price"]').fill("1000");
  await page.locator("form button.btn-gold").click();
  await expect(page.locator(".field-error, [role=alert]").first()).toBeVisible({ timeout: 15_000 });
  expect(new URL(page.url()).pathname).toBe("/dashboard/products/new");
  expect(await page.locator('input[name="name.en"]').inputValue()).toBe(huge);
  // absurd price is refused too
  await page.locator('input[name="name.en"]').fill(`Big price ${tag}`);
  await page.locator('input[name="price"]').evaluate((el) => el.removeAttribute("max"));
  // a multiple of the field's 250 step, so the browser submits it and the server has to refuse it (max 1,000,000,000)
  await page.locator('input[name="price"]').fill("99999999750");
  await page.locator("form button.btn-gold").click();
  await expect(page.getByText("Add a name in at least one language.")).toHaveCount(0, { timeout: 15_000 }); // fresh server answer
  await expect(page.locator(".field-error").first()).toBeVisible({ timeout: 15_000 });
  expect(new URL(page.url()).pathname).toBe("/dashboard/products/new");

  // --- shopper side: markup renders as text, search with SQL is harmless, checkout double click = one order
  const shopper = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: ownIp(baseURL) });
  await shopper.addCookies([{ name: "mm_locale", value: "en", domain: host, path: "/" }]);
  const sp = await shopper.newPage();
  const spDialogs = [];
  sp.on("dialog", (d) => {
    spDialogs.push(d.message());
    d.dismiss().catch(() => {});
  });
  const res = await sp.goto(`/s/${slug}?q=${encodeURIComponent(SQLI)}`, { waitUntil: "networkidle" });
  expect(res.status()).toBe(200);
  await sp.goto(`/s/${slug}`, { waitUntil: "networkidle" });
  await expect(sp.getByText(name).first()).toBeVisible(); // the literal string, tags and all
  await sp.getByRole("link", { name: new RegExp(`Abuse ${tag}`) }).first().click();
  await sp.waitForURL(`**/s/${slug}/p/**`);
  await expect(sp.getByText("<b>XL</b>").first()).toBeVisible();
  expect(await sp.evaluate(() => window.__pwned)).toBeUndefined();
  expect(await sp.locator("img[src='x']").count()).toBe(0);
  await sp.getByTestId("buy-add").click();
  await sp.goto(`/s/${slug}/cart`, { waitUntil: "networkidle" });
  await sp.locator('input[name="customerName"]').fill(`Shopper ${XSS}`.slice(0, 80)); // the server caps names at 80
  await sp.locator('input[name="phone"]').fill("07701234568");
  const area = sp.locator('select[name="areaId"]');
  if (await area.count()) {
    const opts = await area.locator("option").evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
    if (opts.length) await area.selectOption(opts[0]);
  }
  const city = sp.locator('select[name="city"]');
  if (await city.count()) await city.selectOption({ index: 1 }).catch(() => {});
  const addr = sp.locator('textarea[name="address"]');
  if (await addr.count()) await addr.fill(SQLI);
  await sp.getByTestId("place-order").dblclick();
  await sp.waitForURL(`**/s/${slug}/order/**`, { timeout: 30_000 });
  expect(await sp.evaluate(() => window.__pwned)).toBeUndefined();
  await shopper.close();

  await page.waitForTimeout(1500);
  await page.goto("/dashboard/orders", { waitUntil: "networkidle" });
  const orderLinks = page.locator('a[href^="/dashboard/orders/"]:not([href*="courier"])');
  await expect(orderLinks).toHaveCount(1);
  await orderLinks.first().click();
  await page.waitForURL("**/dashboard/orders/**");
  await expect(page.getByText(/Shopper <img/).first()).toBeVisible();
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  expect([...dialogs, ...spDialogs].filter((m) => !/delete|sure/i.test(m))).toEqual([]);
  await ctx.close();
});
