import { expect, test } from "@playwright/test";

/**
 * hark-audit/mobilefix (2026-10-17): on an Android phone the header menu and the language switcher "did nothing" and the
 * Kurdish "نوێ" badge lost the mark under ێ.
 *  - Taps before hydration were dropped (slow mobile network: the page paints seconds before its JS runs). The menu is now
 *    a native popover and the language dropdown a native <details> + server-action form, so both work with no JS at all.
 *  - Badges used leading-none inside an overflow-hidden `truncate` span: any Arabic-script font taller than Vazirmatn
 *    (the phone's own font while web fonts load) was clipped. Pills now use line-height 1.5 + padding-block.
 * Runs against a production build or the live site (playwright.live.config.mjs). STORE_SLUG defaults to the demo store.
 */
const SLUG = process.env.STORE_SLUG ?? "hawler-bazaar";
const HTML_LANG = { ku: "ckb", ar: "ar", en: "en", kmr: "kmr" };
const LABEL = { ku: "سۆرانی", ar: "العربية", en: "English", kmr: "Kurmancî" };

async function phone(browser, baseURL, { width, locale, js = true, fonts = true }) {
  const host = new URL(baseURL).hostname;
  const context = await browser.newContext({ viewport: { width, height: 860 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, javaScriptEnabled: js });
  await context.addCookies([{ name: "mm_locale", value: locale, domain: host, path: "/" }]);
  if (!fonts) await context.route(/\.woff2(\?|$)/, (r) => r.abort()); // draw Kurdish in the system Arabic font, as a phone does while fonts load
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page, errors };
}

const noOverflow = async (page) => {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  expect(sw).toBeLessThanOrEqual(iw);
};

for (const width of [360, 412]) {
  for (const [from, to] of [["ku", "en"], ["ar", "kmr"], ["en", "ku"], ["kmr", "ar"]]) {
    test(`${width}px ${from}→${to}: menu opens on tap, language switches, no errors, no overflow`, async ({ browser, baseURL }) => {
      const { context, page, errors } = await phone(browser, baseURL, { width, locale: from });
      await page.goto("/", { waitUntil: "networkidle" });
      await noOverflow(page);
      const btn = page.locator("[data-nav-menu-button]");
      await btn.tap();
      const sheet = page.locator("[data-mobile-sheet]");
      await expect(sheet).toBeVisible();
      await expect(btn).toHaveAttribute("aria-expanded", "true");
      await sheet.locator("[data-lang-trigger]").tap();
      await sheet.locator('[role="menuitemradio"]', { hasText: LABEL[to] }).tap();
      await expect(page.locator("html")).toHaveAttribute("lang", HTML_LANG[to], { timeout: 15_000 });
      await expect(page.locator("html")).toHaveAttribute("dir", to === "ku" || to === "ar" ? "rtl" : "ltr");
      await noOverflow(page);
      expect(errors).toEqual([]);
      await context.close();
    });
  }

  test(`${width}px store: language control switches, cart/search are links, no errors, no overflow`, async ({ browser, baseURL }) => {
    const { context, page, errors } = await phone(browser, baseURL, { width, locale: "ku" });
    await page.goto(`/s/${SLUG}`, { waitUntil: "networkidle" });
    await noOverflow(page);
    await expect(page.locator(`header a[href="/s/${SLUG}/cart"]`).first()).toBeVisible();
    const dd = page.locator("[data-lang-dropdown]").last();
    await dd.scrollIntoViewIfNeeded();
    await dd.locator("[data-lang-trigger]").tap();
    await dd.locator('[role="menuitemradio"]', { hasText: "English" }).tap();
    await expect(page.locator("html")).toHaveAttribute("lang", "en", { timeout: 15_000 });
    await noOverflow(page);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test("before hydration (no JS): the menu still opens and a language pick still applies", async ({ browser, baseURL }) => {
  const { context, page } = await phone(browser, baseURL, { width: 412, locale: "ku", js: false });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("[data-nav-menu-button]").tap();
  const sheet = page.locator("[data-mobile-sheet]");
  await expect(sheet).toBeVisible();
  await sheet.locator("[data-lang-trigger]").tap();
  await sheet.locator('[role="menuitemradio"]', { hasText: "English" }).tap();
  await expect(page.locator("html")).toHaveAttribute("lang", "en", { timeout: 20_000 });
  await context.close();
});

for (const locale of ["ku", "ar"]) {
  for (const fonts of [true, false]) {
    test(`store badges keep their Kurdish/Arabic marks (${locale}, ${fonts ? "web fonts" : "system Arabic font"})`, async ({ browser, baseURL }) => {
      const { context, page } = await phone(browser, baseURL, { width: 412, locale, fonts });
      await page.goto(`/s/${SLUG}`, { waitUntil: "networkidle" });
      const badges = page.locator('[data-testid^="badge-"]');
      expect(await badges.count()).toBeGreaterThan(0);
      const clipped = await badges.evaluateAll((els) =>
        els.flatMap((b) => [b, ...b.querySelectorAll("*")])
          .filter((e) => e.scrollHeight > e.clientHeight + 1)
          .map((e) => `${e.textContent} ${e.scrollHeight}>${e.clientHeight}`),
      );
      expect(clipped).toEqual([]);
      await context.close();
    });
  }
}
