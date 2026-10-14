import { expect, test } from "@playwright/test";
import { auditInPage } from "./support.mjs";

/**
 * Legal + SEO (agentb/legal-seo): /terms, /privacy, /refund in 4 locales (200, no 360px overflow, doc switcher),
 * footer + signup link to them, robots.txt / sitemap.xml are served, OG tags are present.
 */
const ctx = async (browser, baseURL, locale, width) => {
  const host = new URL(baseURL).hostname;
  const context = await browser.newContext({ viewport: { width, height: 860 }, ...(width < 500 ? { isMobile: true, hasTouch: true } : {}) });
  await context.addCookies([{ name: "mm_locale", value: locale, domain: host, path: "/" }]);
  return context;
};

for (const locale of ["ku", "ar", "en", "kmr"]) {
  test(`legal pages render in ${locale} without overflow at 360px`, async ({ browser, baseURL }) => {
    const context = await ctx(browser, baseURL, locale, 360);
    const page = await context.newPage();
    for (const doc of ["terms", "privacy", "refund"]) {
      const res = await page.goto(`/${doc}`, { waitUntil: "networkidle" });
      expect(res?.status(), doc).toBe(200);
      await expect(page.getByTestId(`legal-${doc}`)).toBeVisible();
      await expect(page.locator(`[data-testid="legal-${doc}"] h1`)).toHaveCount(1);
      expect(await page.locator(`[data-testid="legal-${doc}"] section h2`).count()).toBeGreaterThanOrEqual(5);
      const sw = await page.evaluate(() => document.scrollingElement.scrollWidth);
      const audit = await page.evaluate(auditInPage, 360);
      expect(sw, `${doc}: ${audit.offenders.slice(0, 8).join(" | ")}`).toBeLessThanOrEqual(360);
    }
    await context.close();
  });
}

test("footer and signup link the legal pages", async ({ browser, baseURL }) => {
  const context = await ctx(browser, baseURL, "en", 1280);
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "networkidle" });
  const footer = page.getByTestId("site-footer");
  for (const href of ["/terms", "/privacy", "/refund"]) await expect(footer.locator(`a[href="${href}"]`)).toHaveCount(1);
  await footer.locator('a[href="/privacy"]').click();
  await page.waitForURL("**/privacy");
  await expect(page.getByTestId("legal-privacy")).toBeVisible();
  await page.goto("/signup", { waitUntil: "networkidle" });
  const legal = page.getByTestId("signup-legal");
  await expect(legal.locator('a[href="/terms"]')).toHaveCount(1);
  await expect(legal.locator('a[href="/privacy"]')).toHaveCount(1);
  await context.close();
});

test("robots.txt, sitemap.xml and Open Graph tags", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const r = await robots.text();
  expect(r).toContain("Disallow: /dashboard");
  expect(r).toMatch(/Sitemap: https?:\/\/\S+\/sitemap\.xml/);
  const sm = await request.get("/sitemap.xml");
  expect(sm.status()).toBe(200);
  const xml = await sm.text();
  expect(xml).toContain("<urlset");
  expect(xml).toContain("/terms</loc>");
  expect(xml).toContain("/s/hawler-bazaar</loc>");
  expect(xml).not.toContain("/dashboard");
  const home = await (await request.get("/", { headers: { accept: "text/html" } })).text();
  expect(home).toMatch(/<meta property="og:image" content="https?:\/\/[^"]+\/og\.png"/);
  expect(home).toContain('name="twitter:card" content="summary_large_image"');
  const og = await request.get("/og.png");
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toContain("image/png");
});
