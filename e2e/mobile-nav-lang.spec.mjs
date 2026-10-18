import { expect, test } from "@playwright/test";

/**
 * agentb/mobile-nav-lang: phone header is logo + hamburger only, hero floating cards are desktop-only, and the
 * language dropdown (header sheet + Why demo) opens inside the viewport at 360px in RTL and LTR, with Esc/outside close.
 */
const go = async (browser, baseURL, locale, width) => {
  const host = new URL(baseURL).hostname;
  const context = await browser.newContext({ viewport: { width, height: 800 }, ...(width < 500 ? { isMobile: true, hasTouch: true } : {}) });
  await context.addCookies([{ name: "mm_locale", value: locale, domain: host, path: "/" }]);
  const page = await context.newPage();
  const res = await page.goto("/", { waitUntil: "networkidle" });
  expect(res?.status()).toBe(200);
  return { context, page };
};

const inViewport = async (loc, width) => {
  const b = await loc.boundingBox();
  expect(b).toBeTruthy();
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(width + 0.5);
};

for (const locale of ["ku", "ar", "en", "kmr"]) {
  test(`360px ${locale}: header logo+menu only, no hero floating cards, dropdowns stay on screen`, async ({ browser, baseURL }) => {
    const { context, page } = await go(browser, baseURL, locale, 360);
    await expect(page.locator("[data-nav-cta]")).toBeHidden();
    await expect(page.locator("[data-nav-menu-button]")).toBeVisible();
    const disp = await page.$$eval("[data-hv-float]", (els) => els.map((e) => getComputedStyle(e).display));
    expect(disp).toEqual(["none", "none"]);
    await expect(page.locator("[data-hero-phone]")).toBeVisible();

    // Why demo dropdown
    const demo = page.locator("[data-tm] [data-lang-dropdown]");
    await demo.scrollIntoViewIfNeeded();
    const trig = demo.locator("[data-lang-trigger]");
    await trig.click();
    await expect(trig).toHaveAttribute("aria-expanded", "true");
    const menu = demo.locator('[role="menu"]');
    await expect(menu.locator('[role="menuitemradio"]')).toHaveCount(4);
    await inViewport(menu, 360);
    const h = await menu.locator('[role="menuitemradio"]').first().evaluate((e) => e.offsetHeight); // layout height (the open animation scales briefly)
    expect(h).toBeGreaterThanOrEqual(44);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trig).toBeFocused();
    const sw = await page.evaluate(() => document.scrollingElement.scrollWidth);
    expect(sw).toBeLessThanOrEqual(360);

    // header sheet: segmented language control (Oct 18 redesign), one pressed, all 44px+, inside the viewport
    await page.locator("[data-nav-menu-button]").click();
    const seg = page.locator("[data-mobile-sheet] [data-menu-lang]");
    await expect(seg).toBeVisible();
    await expect(seg.locator('button[aria-pressed="true"]')).toHaveCount(1);
    await inViewport(seg, 360);
    const small = await seg.locator("button").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length);
    expect(small).toBe(0);
    await page.keyboard.press("Escape");
    await context.close();
  });
}

test("1280 en: desktop header keeps the CTA and the language dropdown, hero keeps floating cards", async ({ browser, baseURL }) => {
  const { context, page } = await go(browser, baseURL, "en", 1280);
  await expect(page.locator("[data-nav-cta]")).toBeVisible();
  const dd = page.locator("[data-locale-menu] [data-lang-dropdown]");
  await dd.locator("[data-lang-trigger]").click();
  const menu = dd.locator('[role="menu"]');
  await expect(menu).toBeVisible();
  await inViewport(menu, 1280);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  // cards stay laid out on desktop (they fade in on scroll via the reveal, so check display, not visibility)
  const shown = await page.$$eval("[data-hv-float]", (els) => els.map((e) => getComputedStyle(e).display));
  expect(shown).toEqual(["block", "block"]);
  await context.close();
});
