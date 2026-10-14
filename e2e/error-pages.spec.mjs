import { expect, test } from "@playwright/test";
import { auditInPage } from "./support.mjs";

/**
 * Error pages (agentb/error-pages):
 *  - unknown store links, /payments/return (payments off) and unknown URLs answer a REAL 404 status
 *  - the 404 body is the branded page in the visitor's locale, with no horizontal overflow at 360px
 *  - an existing store still answers 200 (the proxy existence check never hides a real store)
 */
const ctx = async (browser, baseURL, locale, width) => {
  const host = new URL(baseURL).hostname;
  const context = await browser.newContext({ viewport: { width, height: 860 }, ...(width < 500 ? { isMobile: true, hasTouch: true } : {}) });
  await context.addCookies([{ name: "mm_locale", value: locale, domain: host, path: "/" }]);
  return context;
};

test("real 404 status: unknown store, payments return (off), unknown URL, /e404", async ({ request }) => {
  const html = { headers: { accept: "text/html" } };
  for (const path of ["/s/no-such-store-zz", "/s/no-such-store-zz/p/00000000-0000-0000-0000-000000000000", "/s/BAD_SLUG!", "/payments/return", "/payments/return?p=not-a-uuid", "/this-page-does-not-exist", "/e404"]) {
    const res = await request.get(path, html);
    expect(res.status(), path).toBe(404);
    const body = await res.text();
    expect(body, path).toContain('data-testid="');
    expect(body.includes("store-missing") || body.includes("platform-not-found"), path).toBe(true);
  }
  // A real store is untouched.
  const ok = await request.get("/s/hawler-bazaar", html);
  expect(ok.status()).toBe(200);
});

for (const [locale, width] of [["ku", 360], ["ar", 360], ["en", 1280], ["kmr", 360]]) {
  test(`unknown store 404 page renders in ${locale} without overflow (${width}px)`, async ({ browser, baseURL }) => {
    const context = await ctx(browser, baseURL, locale, width);
    const page = await context.newPage();
    const res = await page.goto("/s/no-such-store-zz", { waitUntil: "networkidle" });
    expect(res?.status()).toBe(404);
    await expect(page.getByTestId("store-missing")).toBeVisible();
    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(lang).toBe(locale === "ku" ? "ckb" : locale);
    const links = page.getByTestId("store-missing").locator("a.btn-gold, a.btn-ghost");
    await expect(links).toHaveCount(2);
    for (const h of await links.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(44);
    const audit = await page.evaluate(auditInPage, width);
    const sw = await page.evaluate(() => document.scrollingElement.scrollWidth);
    expect(sw, audit.offenders.slice(0, 8).join(" | ")).toBeLessThanOrEqual(width);
    await context.close();
  });
}

test("platform 404 has a working home link and no console CSP errors", async ({ browser, baseURL }) => {
  const context = await ctx(browser, baseURL, "en", 1280);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" && /Content Security Policy|CSP/i.test(m.text())) errors.push(m.text()); });
  const res = await page.goto("/this-page-does-not-exist", { waitUntil: "networkidle" });
  expect(res?.status()).toBe(404);
  await expect(page.getByTestId("platform-not-found")).toBeVisible();
  expect(errors).toEqual([]);
  await page.getByTestId("platform-not-found").getByRole("link", { name: "Go to homepage" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await context.close();
});
