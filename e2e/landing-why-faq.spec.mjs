import { expect, test } from "@playwright/test";
import { auditInPage } from "./support.mjs";

/**
 * Landing "/" (agentb/why-faq): Why bento, Who marquee, FAQ accordion.
 * - no horizontal overflow at 360px in ku/ar/en/kmr (with an FAQ item open)
 * - FAQ: one open at a time, aria-expanded in sync, keyboard (Arrow/Home/End, Enter), tap targets >= 44px
 * - FAQPage JSON-LD is present and carries the CSP nonce
 * - reduced motion: tiles fully visible and never blurred, marquee static
 */
const go = async (browser, baseURL, locale, opts = {}) => {
  const host = new URL(baseURL).hostname;
  const context = await browser.newContext({ viewport: { width: opts.width ?? 1280, height: 900 }, reducedMotion: opts.rm ? "reduce" : "no-preference", ...(opts.width && opts.width < 500 ? { isMobile: true, hasTouch: true } : {}) });
  await context.addCookies([{ name: "mm_locale", value: locale, domain: host, path: "/" }]);
  const page = await context.newPage();
  const res = await page.goto("/", { waitUntil: "networkidle" });
  expect(res?.status()).toBe(200);
  return { context, page };
};

for (const locale of ["ku", "ar", "en", "kmr"]) {
  test(`landing has no horizontal overflow at 360px (${locale})`, async ({ browser, baseURL }) => {
    const { context, page } = await go(browser, baseURL, locale, { width: 360 });
    await page.locator(".faq-btn").first().click();
    await page.waitForTimeout(700);
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.scrollingElement.scrollWidth, innerWidth: window.innerWidth }));
    const audit = await page.evaluate(auditInPage, 360);
    expect(innerWidth, audit.offenders.slice(0, 8).join(" | ")).toBe(360);
    expect(scrollWidth, audit.offenders.slice(0, 8).join(" | ")).toBeLessThanOrEqual(innerWidth);
    const small = await page.$$eval(".faq-btn", (els) => els.map((e) => e.getBoundingClientRect().height).filter((h) => h < 44));
    expect(small).toEqual([]);
    await context.close();
  });
}

test("FAQ: single open, aria in sync, keyboard support", async ({ browser, baseURL }) => {
  const { context, page } = await go(browser, baseURL, "en");
  const btns = page.locator("#faq .faq-btn");
  await expect(btns).toHaveCount(8);
  const expanded = () => page.$$eval("#faq .faq-btn", (els) => els.map((e) => e.getAttribute("aria-expanded")));
  expect(await expanded()).toEqual(Array(8).fill("false"));
  await btns.nth(0).click();
  expect((await expanded()).filter((v) => v === "true")).toHaveLength(1);
  await btns.nth(3).click();
  const after = await expanded();
  expect(after[3]).toBe("true");
  expect(after.filter((v) => v === "true")).toHaveLength(1);
  // region is labelled by its button and visible only when open
  const id = await btns.nth(3).getAttribute("aria-controls");
  await expect(page.locator(`#${id}`)).toHaveAttribute("role", "region");
  await expect(page.locator(`#${id} .faq-a`)).toBeVisible();
  await btns.nth(3).click();
  expect(await expanded()).toEqual(Array(8).fill("false"));
  // keyboard
  await btns.nth(0).focus();
  await page.keyboard.press("ArrowDown");
  await expect(btns.nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(btns.nth(7)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(btns.nth(0)).toBeFocused();
  await page.keyboard.press("Enter");
  expect((await expanded())[0]).toBe("true");
  // the answer ends sharp
  await page.waitForTimeout(900);
  const filter = await page.locator("#faq .faq-a").first().evaluate((e) => getComputedStyle(e).filter);
  expect(["none", "blur(0px)"]).toContain(filter);
  await context.close();
});

test("FAQPage JSON-LD is present with the CSP nonce", async ({ browser, baseURL }) => {
  const { context, page } = await go(browser, baseURL, "ar");
  const ld = await page.$$eval('script[type="application/ld+json"]', (els) => els.map((e) => ({ nonce: e.nonce || e.getAttribute("nonce"), text: e.textContent })));
  const faq = ld.map((x) => ({ ...x, data: JSON.parse(x.text) })).find((x) => x.data["@type"] === "FAQPage");
  expect(faq).toBeTruthy();
  expect(faq.nonce, "JSON-LD script carries the request nonce").toBeTruthy();
  expect(faq.data.mainEntity).toHaveLength(8);
  expect(faq.data.mainEntity[0].acceptedAnswer.text.length).toBeGreaterThan(10);
  await context.close();
});

test("reduced motion: bento visible + sharp, marquee static", async ({ browser, baseURL }) => {
  const { context, page } = await go(browser, baseURL, "ku", { rm: true, width: 390 });
  await page.locator(".why-band").scrollIntoViewIfNeeded();
  const tiles = await page.$$eval(".bento-tile", (els) => els.map((e) => [getComputedStyle(e).opacity, getComputedStyle(e).filter]));
  expect(tiles).toHaveLength(4);
  for (const [o, f] of tiles) {
    expect(o).toBe("1");
    expect(f).toBe("none");
  }
  const anim = await page.$eval(".marquee-track", (e) => getComputedStyle(e).animationName);
  expect(anim).toBe("none");
  await context.close();
});
