/**
 * Mobile RTL audit: screenshots every key storefront + dashboard route at 360/390/414/430 px in ku and en, and
 * reports horizontal overflow, tap targets under 44 px, and inputs under 16 px (iOS focus zoom).
 *   BASE_URL=http://localhost:3000 [CHROMIUM_PATH=/usr/bin/chromium] [SHOTS_DIR=./mobile-shots] node scripts/mobile-shots.mjs
 * Needs a running production build with the demo seed. Writes PNGs + report.json into SHOTS_DIR.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { BASE, CHROMIUM, auditInPage, setup } from "../e2e/support.mjs";

const OUT = process.env.SHOTS_DIR ?? "mobile-shots";
const WIDTHS = (process.env.WIDTHS ?? "360,390,414,430").split(",").map(Number);
const LOCALES = (process.env.LOCALES ?? "ku,en").split(",");
mkdirSync(OUT, { recursive: true });

const { session, cart, routes } = await setup();
const browser = await chromium.launch({ executablePath: CHROMIUM });
const host = new URL(BASE).hostname;
const report = [];
const ONLY = process.env.ROUTES?.split(",");
let overflowing = 0;

for (const locale of LOCALES) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const cookies = (anon, extra = []) => [
      { name: "mm_locale", value: locale, domain: host, path: "/" },
      ...(anon ? [] : [{ name: session.name, value: session.value, domain: host, path: "/" }]),
      ...extra.map((c) => ({ ...c, domain: host, path: "/" })),
    ];
    await ctx.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [cart.key, cart.value]);
    const page = await ctx.newPage();
    for (const r of routes.filter((x) => !ONLY || ONLY.includes(x.name))) {
      await ctx.clearCookies();
      await ctx.addCookies(cookies(r.anon, r.cookies));
      await page.goto(BASE + r.path, { waitUntil: "networkidle" });
      if (r.openDetails) await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
      await page.evaluate(() => document.fonts.ready);
      // Scroll through once so lazy images below the fold are in the full-page screenshot, then back to the top.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForLoadState("networkidle");
      const audit = await page.evaluate(auditInPage, width);
      if (audit.overflow) overflowing++;
      const file = `${OUT}/${locale}-${width}-${r.name}.png`;
      await page.screenshot({ path: file, fullPage: true });
      report.push({ locale, width, route: r.name, path: r.path, ...audit });
      const flag = audit.overflow ? "✗ OVERFLOW" : "✓";
      console.log(`${flag} ${locale} ${width}px ${r.name}  scrollW=${audit.scrollWidth}  small-targets=${audit.smallTargetCount}  small-inputs=${audit.smallInputs.length}`);
      for (const o of audit.offenders.slice(0, 5)) console.log(`     ↳ ${o}`);
    }
    await ctx.close();
  }
}
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(`\n${overflowing} overflowing page(s); screenshots + report.json in ${OUT}/`);
process.exit(overflowing ? 1 : 0);
