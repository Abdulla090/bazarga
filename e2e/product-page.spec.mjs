import { expect, test } from "@playwright/test";
import { SLUG } from "./support.mjs";

/**
 * Product page at 360 px in Sorani: info first (name → price with sale + % off → short description) right under the
 * gallery, then options/stock, quantity and buy buttons; multi-photo gallery with counter + thumbnails, the lazy
 * fullscreen viewer, "Best seller" badge, offer banner, details table, related strip and Product JSON-LD.
 * Also the store home's merchandising: offer banner, best sellers (from real seeded orders), offers strip + filter.
 */
const ctxFor = async (browser, baseURL) => {
  const host = new URL(baseURL).hostname;
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
  await context.addCookies([{ name: "mm_locale", value: "ku", domain: host, path: "/" }]);
  return context;
};
const noOverflow = async (page) => {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.scrollingElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
};
const top = (loc) => loc.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);

test("product page: info first, gallery, viewer, offers, details and JSON-LD (ku, 360px)", async ({ browser, baseURL }) => {
  const context = await ctxFor(browser, baseURL);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  // The honey jar: a simple product on sale with 4 photos, a best seller in the seeded orders.
  await page.goto(`/s/${SLUG}`);
  const html = await page.content();
  const ids = [...new Set([...html.matchAll(new RegExp(`/s/${SLUG}/p/([0-9a-f-]{36})`, "g"))].map((m) => m[1]))];
  let found = null;
  for (const id of ids) {
    await page.goto(`/s/${SLUG}/p/${id}`, { waitUntil: "networkidle" });
    if ((await page.getByTestId("sku").textContent().catch(() => ""))?.includes("HB-HONEY-1KG")) {
      found = id;
      break;
    }
  }
  expect(found, "the demo honey jar").not.toBeNull();

  // Order on a phone: gallery → name → price → description → stock → quantity → buy buttons → trust row → details.
  const order = await Promise.all(
    ["gallery", "product-name", "price", "product-summary", "stock-status", "qty", "trust-row", "product-offers", "section-details"].map((id) =>
      top(page.getByTestId(id).first()),
    ),
  );
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  await expect(page.getByTestId("pct-off")).toContainText("17");
  await expect(page.getByTestId("you-save")).toBeVisible();
  await expect(page.getByTestId("badge-best").first()).toContainText("پڕفرۆشترین"); // on the gallery photo
  await expect(page.getByTestId("offer-code")).toHaveText("NEWROZ");
  await expect(page.getByTestId("free-delivery-note")).toBeVisible();

  await expect(page.getByTestId("gallery-counter")).toHaveText("1/4");
  await expect(page.getByTestId("gallery-thumbs").locator("button")).toHaveCount(4);
  await page.getByTestId("gallery-thumbs").locator("button").nth(2).click();
  await expect(page.getByTestId("gallery-counter")).toHaveText("3/4");

  // Fullscreen viewer is a lazy chunk: opens on tap, shows the same photo, Esc closes it.
  await page.getByTestId("gallery").locator("button").nth(2).click();
  const viewer = page.getByTestId("lightbox");
  await expect(viewer).toBeVisible();
  await expect(page.getByTestId("lightbox-counter")).toHaveText("3/4");
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);

  await expect(page.getByTestId("sku")).toContainText("HB-HONEY-1KG");
  await page.getByRole("button", { name: "زیادکردن" }).first().click();
  await expect(page.getByTestId("qty")).toHaveText("2");
  await expect(page.getByTestId("specs-table").locator("tr")).toHaveCount(3);
  await expect(page.getByTestId("trust-row").locator("li")).toHaveCount(4);
  await expect(page.getByTestId("related").locator("li")).toHaveCount(3);

  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  expect(ld["@type"]).toBe("Product");
  expect(ld.offers.priceCurrency).toBe("IQD");
  expect(ld.offers.availability).toBe("https://schema.org/InStock");

  await noOverflow(page);

  // The dress: long description starts clamped with "Read more" (CSS-only), sizes come after it.
  for (const id of ids) {
    if (id === found) continue;
    await page.goto(`/s/${SLUG}/p/${id}`, { waitUntil: "networkidle" });
    if (await page.getByTestId("read-more").count()) break;
  }
  const more = page.getByTestId("read-more");
  await expect(more).toBeVisible();
  const text = page.getByTestId("summary-text");
  const clamped = await text.evaluate((el) => el.scrollHeight > el.clientHeight + 2);
  expect(clamped, "long description is clamped").toBe(true);
  expect(await top(page.getByTestId("product-summary"))).toBeLessThan(await top(page.locator("fieldset").first()));
  await more.click();
  await expect(more).toBeHidden();
  expect(await text.evaluate((el) => el.scrollHeight <= el.clientHeight + 2)).toBe(true);
  await expect(page.getByTestId("badge-best").first()).toBeVisible();
  await noOverflow(page);

  expect(errors.filter((e) => /Content Security Policy|Refused/.test(e))).toEqual([]);
  await context.close();
});

test("store home: offer banner, best sellers, offers strip and filter (ku, 360px)", async ({ browser, baseURL }) => {
  const context = await ctxFor(browser, baseURL);
  const page = await context.newPage();
  await page.goto(`/s/${SLUG}`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("offer-banner")).toBeVisible();
  await expect(page.getByTestId("offer-code")).toHaveText("NEWROZ");
  // Seeded orders: honey ×3, dress ×2, scarf ×1 (a cancelled skincare order doesn't count); the overflow spec's
  // setup may have added one more order, so the scarf can reach 2 orders and its own badge.
  await expect(page.getByTestId("best-sellers").locator("li")).toHaveCount(3);
  const badged = await page.getByTestId("best-sellers").getByTestId("badge-best").count();
  expect(badged).toBeGreaterThanOrEqual(1); // a sale item shows only its "−%" badge
  expect(badged).toBeLessThanOrEqual(3);
  await expect(page.getByTestId("offers-strip").locator("li")).toHaveCount(2);
  await expect(page.getByTestId("badge-new").first()).toBeVisible();
  await noOverflow(page);

  await page.getByTestId("offers-chip").click();
  await expect(page).toHaveURL(/offers=1/);
  await expect(page.getByTestId("best-sellers")).toHaveCount(0);
  await expect(page.getByTestId("grid-title")).toBeVisible();
  await expect(page.locator("article")).toHaveCount(2);
  await expect(page.locator("article").getByTestId("badge-sale")).toHaveCount(2);
  await noOverflow(page);
  await context.close();
});
