import { expect, test } from "@playwright/test";
import { auditInPage, setup } from "./support.mjs";

/**
 * No horizontal overflow at 360 px (the narrowest common Android width) on every key storefront and dashboard
 * route, in Sorani (RTL) and English (LTR): document.scrollingElement.scrollWidth <= innerWidth.
 */
const WIDTH = 360;
let ctx;

test.beforeAll(async () => {
  ctx = await setup();
});

for (const locale of ["ku", "en"]) {
  test(`no horizontal overflow at ${WIDTH}px (${locale})`, async ({ browser, baseURL }) => {
    const host = new URL(baseURL).hostname;
    const context = await browser.newContext({ viewport: { width: WIDTH, height: 800 }, isMobile: true, hasTouch: true });
    await context.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [ctx.cart.key, ctx.cart.value]);
    const page = await context.newPage();
    for (const r of ctx.routes) {
      await context.clearCookies();
      await context.addCookies([
        { name: "mm_locale", value: locale, domain: host, path: "/" },
        ...(r.anon ? [] : [{ name: ctx.session.name, value: ctx.session.value, domain: host, path: "/" }]),
      ]);
      const res = await page.goto(r.path, { waitUntil: "networkidle" });
      expect(res?.status(), `${r.name} status`).toBeLessThan(400);
      if (r.openDetails) {
        await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
        await page.waitForTimeout(100);
      }
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.scrollingElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      const audit = await page.evaluate(auditInPage, WIDTH);
      expect.soft(innerWidth, `${r.name}: layout viewport widened by content — ${audit.offenders.slice(0, 3).join(" | ")}`).toBe(WIDTH);
      expect.soft(scrollWidth, `${r.name}: scrollWidth > innerWidth — ${audit.offenders.slice(0, 3).join(" | ")}`).toBeLessThanOrEqual(innerWidth);
      expect.soft(audit.smallInputs, `${r.name}: inputs under 16px zoom on iOS`).toEqual([]);
    }
    await context.close();
  });
}
