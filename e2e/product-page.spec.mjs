import { expect, test } from "@playwright/test";
import { SLUG } from "./support.mjs";

/**
 * Product page at 360 px in Sorani: multi-photo gallery with counter + thumbnails, the lazy fullscreen viewer
 * (opens on tap, swipes, closes with Esc), quantity stepper, details table, related strip and Product JSON-LD.
 */
test("product page gallery, viewer, details and JSON-LD (ku, 360px)", async ({ browser, baseURL }) => {
  const host = new URL(baseURL).hostname;
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
  await context.addCookies([{ name: "mm_locale", value: "ku", domain: host, path: "/" }]);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  // The honey jar: a simple product on sale with 4 photos.
  await page.goto(`/s/${SLUG}`);
  const html = await page.content();
  const ids = [...new Set([...html.matchAll(new RegExp(`/s/${SLUG}/p/([0-9a-f-]{36})`, "g"))].map((m) => m[1]))];
  let found = null;
  for (const id of ids) {
    await page.goto(`/s/${SLUG}/p/${id}`, { waitUntil: "networkidle" });
    if (await page.getByTestId("pct-off").count()) {
      found = id;
      break;
    }
  }
  expect(found, "a demo product with a compare-at price").not.toBeNull();

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

  await expect(page.getByTestId("pct-off")).toContainText("17");
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

  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.scrollingElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  expect(errors.filter((e) => /Content Security Policy|Refused/.test(e))).toEqual([]);
  await context.close();
});
