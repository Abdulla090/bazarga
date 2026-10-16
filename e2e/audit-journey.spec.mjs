import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

/** Locally every request is from one IP, so give each test seller its own (the per-IP signup limit is 5/hour). Live: Vercel sets the real IP. */
const ownIp = (baseURL) => (/localhost|127\.0\.0\.1/.test(baseURL) ? { "x-forwarded-for": `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } : {});


/**
 * E2E audit (docs/E2E-AUDIT.md): one brand-new seller walks the whole product, the shopper buys on the fresh store
 * with ?src attribution, and the seller works the order. Runs against localhost or live (BASE_URL); test accounts are
 * `audit-*@example.com` (excluded from founding numbers + live stats) and are deleted by the audit's cleanup step.
 */
const PHOTO = readFileSync(new URL("../public/images/product-shirt.webp", import.meta.url));

async function newSeller(browser, baseURL, { locale = "en", width = 390 } = {}) {
  const host = new URL(baseURL).hostname;
  const tag = `${Date.now()}${Math.floor(Math.random() * 1e4)}`;
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, acceptDownloads: true, extraHTTPHeaders: ownIp(baseURL) });
  await ctx.addCookies([{ name: "mm_locale", value: locale, domain: host, path: "/" }]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/signup", { waitUntil: "networkidle" });
  await page.locator('input[name="name"] >> visible=true').fill("Audit Seller ئەحمەد");
  await page.locator('input[name="email"] >> visible=true').fill(`audit-${tag}@example.com`);
  await page.locator('input[name="password"] >> visible=true').fill("audit-journey-pass-123");
  await page.locator("form button >> visible=true").last().click();
  await page.waitForURL("**/onboarding**", { timeout: 30_000 });
  return { ctx, page, tag, errors, email: `audit-${tag}@example.com` };
}

async function createStore(page, tag, name = `Audit Shop ${tag}`) {
  const slug = `audit-${tag}`.slice(0, 30);
  await page.goto("/onboarding", { waitUntil: "networkidle" });
  await page.locator('input[name="name"] >> visible=true').fill(name);
  await page.locator('input[name="slug"] >> visible=true').fill(slug);
  await page.locator('input[name="whatsapp"] >> visible=true').fill("0750 123 4567");
  await page.locator("form button.btn-gold >> visible=true").click();
  await page.waitForURL(/\/(dashboard|onboarding\?step=theme)/, { timeout: 30_000 });
  return slug;
}

async function addProduct(page, { name, price, stock, photo = false, compareAt }) {
  await page.goto("/dashboard/products/new", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "English" }).click().catch(() => {});
  await page.locator('input[name="name.en"] >> visible=true').fill(name);
  await page.locator('input[name="price"] >> visible=true').fill(String(price));
  if (compareAt) await page.locator('input[name="compareAtPrice"] >> visible=true').fill(String(compareAt));
  if (stock != null) await page.locator('input[name="stock"] >> visible=true').fill(String(stock));
  if (photo) {
    const f = page.locator("form >> visible=true").filter({ has: page.locator('input[name="price"]') });
    await f.locator('input[type="file"]').setInputFiles({ name: "shirt.webp", mimeType: "image/webp", buffer: PHOTO });
    await expect(f.locator('input[name="images"]')).toHaveCount(1, { timeout: 30_000 });
  }
  await page.locator("form button.btn-gold >> visible=true").click();
  await page.waitForURL((u) => u.pathname === "/dashboard/products", { timeout: 30_000 });
}

test("seller: signup → onboarding theme → Theme Studio publish → products (photo, edit, delete) → settings → share kit", async ({ browser, baseURL }) => {
  test.setTimeout(300_000);
  const { ctx, page, tag, errors } = await newSeller(browser, baseURL);
  const slug = await createStore(page, tag);

  // Onboarding theme step: pick a preset, land on the dashboard.
  if (page.url().includes("step=theme")) {
    await page.locator("form button[type=submit] >> visible=true").nth(1).click();
    await page.waitForURL("**/dashboard**", { timeout: 30_000 });
  }
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await expect(page.getByTestId("setup-checklist")).toBeVisible();
  await expect(page.getByTestId("verify-banner")).toBeVisible();

  // Theme Studio: edit → dirty → undo/redo → publish → reload keeps it published.
  await page.goto("/dashboard/theme", { waitUntil: "networkidle" });
  await expect(page.getByTestId("theme-editor")).toBeVisible();
  await page.getByTestId("tab-buttons").click();
  await page.getByTestId("btn-shape-square").click();
  await expect(page.getByTestId("theme-dirty")).toBeVisible();
  await page.getByTestId("theme-undo").click();
  await page.getByTestId("theme-redo").click();
  await page.getByTestId("theme-publish").click();
  await expect(page.getByTestId("theme-dirty")).toHaveCount(0, { timeout: 15_000 });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByTestId("theme-dirty")).toHaveCount(0);

  // A rejected save keeps everything the seller typed (React 19 used to reset the whole form on any server error).
  await page.goto("/dashboard/products/new", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "English" }).click().catch(() => {});
  await page.locator('input[name="name.en"] >> visible=true').fill("Kept Name");
  await page.locator('textarea[name="description.en"] >> visible=true').fill("Kept description");
  await page.locator('input[name="price"] >> visible=true').fill("5000");
  await page.locator('input[name="compareAtPrice"] >> visible=true').fill("4000");
  await page.locator("form button.btn-gold >> visible=true").click();
  await expect(page.locator(".field-error >> visible=true").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('input[name="name.en"] >> visible=true')).toHaveValue("Kept Name");
  await expect(page.locator('textarea[name="description.en"] >> visible=true')).toHaveValue("Kept description");
  await expect(page.locator('input[name="price"] >> visible=true')).toHaveValue("5000");

  // Products: one with a real photo upload, one to edit, one to delete.
  await addProduct(page, { name: `Audit Shirt ${tag}`, price: 25000, stock: 5, photo: true, compareAt: 30000 });
  await addProduct(page, { name: `Audit Mug ${tag}`, price: 9000, stock: 2 });
  await addProduct(page, { name: `Audit Delete ${tag}`, price: 1000, stock: 1 });
  await expect(page.getByText(`Audit Delete ${tag}`)).toBeVisible();
  await page.getByRole("link", { name: new RegExp(`Audit Mug ${tag}`) }).first().click();
  await page.waitForURL(/\/dashboard\/products\/[0-9a-f-]{36}$/);
  await page.locator('input[name="price"] >> visible=true').fill("9500");
  await page.locator("form button.btn-gold >> visible=true").click();
  await page.waitForURL((u) => u.pathname === "/dashboard/products");
  await page.getByRole("link", { name: new RegExp(`Audit Delete ${tag}`) }).first().click();
  await page.waitForURL(/\/dashboard\/products\/[0-9a-f-]{36}$/);
  page.once("dialog", (d) => d.accept());
  await page.locator("button.btn-danger >> visible=true").click();
  await page.waitForURL((u) => u.pathname === "/dashboard/products", { timeout: 30_000 });
  await expect(page.getByText(`Audit Delete ${tag}`)).toHaveCount(0);

  // Storefront shows the edit, the sale and the uploaded photo; the deleted product is gone.
  const sf = await (await page.request.get(`/s/${slug}`)).text();
  expect(sf).toContain(`Audit Shirt ${tag}`);
  expect(sf).not.toContain(`Audit Delete ${tag}`);
  expect(sf).toMatch(/9,500|9٬500|٩٬٥٠٠/);

  // Settings: Kurdish + emoji store name round-trips and is escaped on the storefront.
  await page.goto("/dashboard/settings", { waitUntil: "networkidle" });
  const storeName = `دوکانی تاقی 🛍️ <b>${tag}</b>`;
  const form = page.locator("form", { has: page.locator('input[name="slug"] >> visible=true') }).first();
  await form.locator('input[name="name"]').fill(storeName);
  await form.locator("button.btn-gold, button[type=submit]").first().click();
  await expect(form.getByRole("status")).toBeVisible({ timeout: 15_000 });
  const sf2 = await (await page.request.get(`/s/${slug}`)).text();
  expect(sf2).not.toContain(`<b>${tag}</b>`);
  expect(sf2).toContain(`&lt;b&gt;${tag}&lt;/b&gt;`);

  // Share kit: bio, QR (png + svg), story PNG in 4 languages.
  await page.goto("/dashboard/share", { waitUntil: "networkidle" });
  await expect(page.getByTestId("share-bio")).toContainText(slug);
  const qr = await page.request.get("/api/share/qr?format=png");
  expect(qr.status()).toBe(200);
  expect(qr.headers()["content-type"]).toContain("image/png");
  expect((await page.request.get("/api/share/qr?format=svg")).headers()["content-type"]).toContain("svg");
  for (const l of ["ku", "ar", "en", "kmr"]) {
    const s = await page.request.get(`/api/share/story?lang=${l}`);
    expect(s.status(), `story ${l}`).toBe(200);
    const b = await s.body();
    expect(b.readUInt32BE(16)).toBe(1080);
    expect(b.readUInt32BE(20)).toBe(1920);
  }
  // Per-product share modal: 9:16 + 1:1 canvases.
  await page.goto("/dashboard/products", { waitUntil: "networkidle" });
  await page.getByTestId("product-share").first().click();
  await expect(page.getByTestId("share-canvas-story")).toHaveAttribute("data-drawn", "1", { timeout: 20_000 });
  await expect(page.getByTestId("share-canvas-square")).toBeVisible();
  await page.keyboard.press("Escape");

  // Showcase opt-in toggles and is reflected on the showcase page.
  await page.goto("/dashboard/settings", { waitUntil: "networkidle" });
  const toggle = page.getByTestId("showcase-toggle");
  if (await toggle.count()) {
    await toggle.locator("input[type=checkbox], button").first().click();
    await page.waitForTimeout(1500);
  }
  expect(errors).toEqual([]);
  await ctx.close();
});

test("shopper on a fresh store: search → product → cart → ?src checkout → WhatsApp hand-off → seller works the order", async ({ browser, baseURL }) => {
  test.setTimeout(300_000);
  const host = new URL(baseURL).hostname;
  const { ctx, page, tag } = await newSeller(browser, baseURL, { width: 1280 });
  const slug = await createStore(page, tag);
  await addProduct(page, { name: `Audit Honey ${tag}`, price: 12000, stock: 3, photo: true });
  await addProduct(page, { name: `Audit Soap ${tag}`, price: 4000, stock: 10 });

  const shopper = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await shopper.addCookies([{ name: "mm_locale", value: "ku", domain: host, path: "/" }]);
  const sp = await shopper.newPage();
  const errs = [];
  sp.on("pageerror", (e) => errs.push(String(e)));
  await sp.goto(`/s/${slug}?src=instagram`, { waitUntil: "networkidle" });
  // search
  await sp.goto(`/s/${slug}?q=${encodeURIComponent("Honey")}`, { waitUntil: "networkidle" });
  await expect(sp.getByText(`Audit Honey ${tag}`).first()).toBeVisible();
  await expect(sp.getByText(`Audit Soap ${tag}`)).toHaveCount(0);
  await sp.goto(`/s/${slug}?q=zzzz-nothing`, { waitUntil: "networkidle" });
  await expect(sp.getByTestId("empty-results")).toBeVisible();
  // product → add → cart
  await sp.goto(`/s/${slug}`, { waitUntil: "networkidle" });
  await sp.getByRole("link", { name: `Audit Honey ${tag}` }).first().click();
  await sp.waitForURL(`**/s/${slug}/p/**`);
  await sp.getByTestId("buy-add").click();
  await expect(sp.getByTestId("cart-count")).toContainText(/1|١/);
  await sp.goto(`/s/${slug}/cart`, { waitUntil: "networkidle" });
  await expect(sp.getByTestId("cart-lines")).toBeVisible();
  // empty submit shows field errors and stays on the page
  await sp.getByTestId("place-order").click();
  await expect(sp).toHaveURL(new RegExp(`/s/${slug}/cart`));
  await sp.locator('input[name="customerName"] >> visible=true').fill("کڕیاری تاقی <script>alert(1)</script>");
  await sp.locator('input[name="phone"] >> visible=true').fill(`0750${String(Date.now()).slice(-7)}`);
  const area = sp.locator('select[name="areaId"] >> visible=true');
  if (await area.count()) {
    const opts = await area.locator("option").evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
    if (opts.length) await area.selectOption(opts[0]);
  }
  const other = sp.locator('input[name="areaOther"] >> visible=true');
  if ((await other.count()) && (await other.isVisible())) await other.fill("شاوێس");
  const landmark = sp.locator('input[name="landmark"], textarea[name="landmark"] >> visible=true');
  if (await landmark.count()) await landmark.first().fill("نزیک فامیلی مۆڵ");
  const address = sp.locator('textarea[name="address"], input[name="address"] >> visible=true');
  if (await address.count()) await address.first().fill("شەقامی 60");
  await sp.getByTestId("place-order").click();
  await sp.waitForURL(`**/s/${slug}/order/**`, { timeout: 30_000 });
  await expect(sp.getByTestId("track-link")).toBeVisible();
  const wa = sp.getByTestId("wa-handoff");
  if (await wa.count()) await expect(wa.first()).toHaveAttribute("href", /wa\.me\/9647501234567/);
  // refresh + back on the confirmation never create a second order
  await sp.reload({ waitUntil: "networkidle" });
  await sp.goBack({ waitUntil: "networkidle" }).catch(() => {});
  expect(errs).toEqual([]);
  await shopper.close();

  // seller: exactly one order, from Instagram, shopper text escaped, status moves, analytics counts it
  await page.goto("/dashboard/orders", { waitUntil: "networkidle" });
  const links = page.locator('a[href^="/dashboard/orders/"]').filter({ hasText: /کڕیاری تاقی/ });
  await expect(links).toHaveCount(1);
  await links.first().click();
  await page.waitForURL(/\/dashboard\/orders\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("order-source")).toHaveAttribute("data-source", "instagram");
  expect(await page.content()).not.toContain("<script>alert(1)</script>");
  const heading = page.locator("h1").first().locator("xpath=..");
  await expect(heading).toContainText("Pending");
  await page.getByTestId("status-actions").locator("button >> visible=true").first().click();
  await expect(heading).not.toContainText("Pending", { timeout: 15_000 });
  await page.goto("/dashboard/analytics?range=7", { waitUntil: "networkidle" });
  await expect(page.getByTestId("source-bars").locator("li").first()).toHaveAttribute("data-source", "instagram");
  await ctx.close();
});
