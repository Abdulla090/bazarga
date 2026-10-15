import { expect, test } from "@playwright/test";
import { SLUG } from "./support.mjs";

/**
 * Social-first (docs/SOCIAL-FIRST.md): the per-product Share modal in the dashboard (canvas images, per-platform links
 * with ?src=, caption, download) and source attribution end to end: a shopper opens a product with ?src=tiktok, orders,
 * and the seller sees "From TikTok" on the order and in Analytics.
 */
const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL ?? "demo@mymarket.app";
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "mymarket-demo";

async function sellerPage(browser, baseURL, { locale = "ku", width = 390 } = {}) {
  const host = new URL(baseURL).hostname;
  const context = await browser.newContext({ viewport: { width, height: 844 }, acceptDownloads: true });
  await context.addCookies([{ name: "mm_locale", value: locale, domain: host, path: "/" }]);
  const page = await context.newPage();
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator('input[name="email"]').fill(DEMO_EMAIL);
  await page.locator('input[name="password"]').fill(DEMO_PASSWORD);
  await page.locator("form button").last().click();
  await page.waitForURL("**/dashboard**", { timeout: 30_000 });
  return { context, page };
}

const noOverflow = async (page) => {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, iw: window.innerWidth }));
  expect(sw).toBeLessThanOrEqual(iw);
};

test("dashboard share modal: canvas story + square, per-platform ?src links, caption, download (ku, 390px)", async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const { context, page } = await sellerPage(browser, baseURL);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/dashboard/products", { waitUntil: "networkidle" });
  await page.getByTestId("product-share").first().click();
  const modal = page.getByTestId("share-modal");
  await expect(modal).toBeVisible();
  await expect(page.getByTestId("share-canvas-story")).toHaveAttribute("data-drawn", "1", { timeout: 20_000 });

  // Both canvases are full size and actually painted (not blank).
  for (const f of ["story", "square"]) {
    const info = await page.getByTestId(`share-canvas-${f}`).evaluate((c) => {
      const ctx = c.getContext("2d");
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const colours = new Set();
      for (let i = 0; i < d.length; i += 4 * 997) colours.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
      return { w: c.width, h: c.height, colours: colours.size };
    });
    expect(info.w).toBe(1080);
    expect(info.h).toBe(f === "story" ? 1920 : 1080);
    expect(info.colours).toBeGreaterThan(8);
  }

  // One tagged link per platform.
  for (const p of ["tiktok", "instagram", "whatsapp", "telegram", "facebook"]) {
    const url = await page.getByTestId(`share-copy-${p}`).getAttribute("data-url");
    expect(url).toMatch(new RegExp(`/s/${SLUG}/p/[0-9a-f-]{36}\\?src=${p}$`));
  }
  // Caption follows the chosen platform and language.
  await expect(page.getByTestId("share-caption")).toHaveValue(/\?src=tiktok/);
  await expect(page.getByTestId("share-caption")).toHaveValue(/پارە لە کاتی گەیاندندا/);
  await page.getByTestId("share-caption-platform").selectOption("instagram");
  await expect(page.getByTestId("share-caption")).toHaveValue(/\?src=instagram/);
  await page.getByTestId("share-lang-en").click();
  await expect(page.getByTestId("share-caption")).toHaveValue(/Cash on delivery/);
  await expect(page.getByTestId("share-wa")).toHaveAttribute("href", /wa\.me\/\?text=.*src%3Dwhatsapp/);

  // Download produces a PNG.
  await expect(page.getByTestId("share-download-story")).toBeEnabled();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("share-download-story").click()]);
  expect(dl.suggestedFilename()).toMatch(/^hawler-bazaar-[0-9a-f]{8}-story\.png$/);

  await noOverflow(page);
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  expect(errors).toEqual([]);
  await context.close();
});

test("source attribution: ?src=tiktok on a product → order → seller sees TikTok", async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const host = new URL(baseURL).hostname;
  const tag = `${Date.now()}`.slice(-6);
  const customer = `Social Test ${tag}`;

  // Pick a simple, buyable product from the store home (same way the mobile checks do).
  const html = await (await fetch(`${baseURL}/s/${SLUG}`)).text();
  const buyable = [...new Set([...html.matchAll(/productId\\?":\\?"([0-9a-f-]{36})/g)].map((m) => m[1]))];
  expect(buyable.length).toBeGreaterThan(0);

  const shopper = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await shopper.addCookies([{ name: "mm_locale", value: "en", domain: host, path: "/" }]);
  const sp = await shopper.newPage();
  const beacon = sp.waitForRequest((r) => r.url().includes(`/api/v/${SLUG}?s=tiktok`), { timeout: 15_000 });
  await sp.goto(`/s/${SLUG}/p/${buyable[0]}?src=tiktok`, { waitUntil: "networkidle" });
  await beacon;
  // Captured, then removed from the address bar so a re-share doesn't carry the seller's attribution.
  await expect.poll(() => new URL(sp.url()).searchParams.get("src")).toBeNull();
  expect(await sp.evaluate((s) => sessionStorage.getItem(`bz:src:${s}`), SLUG)).toBe("tiktok");
  expect((await shopper.cookies()).find((c) => c.name === `bzsrc_${SLUG}`)?.value).toBe("tiktok");

  await sp.evaluate(([key, value]) => localStorage.setItem(key, value), [`mm_cart_${SLUG}`, JSON.stringify([{ productId: buyable[0], variantId: null, quantity: 1 }])]);
  await sp.goto(`/s/${SLUG}/cart`, { waitUntil: "networkidle" });
  await expect(sp.getByTestId("cart-lines")).toBeVisible();
  await sp.locator('input[name="customerName"]').fill(customer);
  await sp.locator('input[name="phone"]').fill(`0750${tag.padStart(7, "1")}`);
  const area = sp.locator('select[name="areaId"]');
  if (await area.count()) {
    const opts = await area.locator("option").evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
    if (opts.length) await area.selectOption(opts[0]);
  }
  const other = sp.locator('input[name="areaOther"]');
  if (await other.count() && (await other.isVisible())) await other.fill("Shawes");
  const landmark = sp.locator('input[name="landmark"], textarea[name="landmark"]');
  if (await landmark.count()) await landmark.first().fill("Near the Family Mall");
  const address = sp.locator('textarea[name="address"], input[name="address"]');
  if (await address.count()) await address.first().fill("Street 60, house 12");
  await sp.getByTestId("place-order").click();
  await sp.waitForURL(`**/s/${SLUG}/order/**`, { timeout: 30_000 });
  await shopper.close();

  const { context, page } = await sellerPage(browser, baseURL, { locale: "en", width: 1280 });
  await page.goto("/dashboard/orders", { waitUntil: "networkidle" });
  await page.locator('a[href^="/dashboard/orders/"]', { hasText: customer }).first().click();
  await page.waitForURL(/\/dashboard\/orders\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("order-source")).toHaveAttribute("data-source", "tiktok");
  await expect(page.getByTestId("order-source")).toContainText("TikTok");

  await page.goto("/dashboard/analytics?range=7", { waitUntil: "networkidle" });
  const bars = page.getByTestId("source-bars");
  await expect(bars).toBeVisible();
  await expect(bars.locator("li").first()).toHaveAttribute("data-source", "tiktok");
  await context.close();
});
