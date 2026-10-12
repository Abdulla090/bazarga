import { chromium } from "@playwright/test";
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = process.env.OUT ?? "/workspace/work/daily-shots/2026-10-13";
const P = process.env.PREFIX ?? "heroviz-";
const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
const host = new URL(BASE).hostname;
async function ctx(w, h, locale, mobile = false) {
  const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await c.addCookies([{ name: "mm_locale", value: locale, domain: host, path: "/" }]);
  return c;
}
const report = {};
for (const [w, h, l, m, name] of [[1280, 800, "en", false, "home-1280-en"], [390, 844, "ku", true, "home-390-ku"], [360, 800, "ku", true, "home-360-ku"], [1280, 800, "ar", false, "home-1280-ar"], [390, 844, "en", true, "home-390-en"]]) {
  const c = await ctx(w, h, l, m); const p = await c.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" }); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/${P}${name}.png` });
  report[name] = await p.evaluate(() => { const v = document.querySelector(".hv"); const r = v?.getBoundingClientRect(); const ph = document.querySelector(".hv-phone")?.getBoundingClientRect(); return { sw: document.scrollingElement.scrollWidth, iw: innerWidth, hvTop: r?.top, phoneTop: ph?.top }; });
  await c.close();
}
{
  const c = await ctx(1280, 800, "en"); const p = await c.newPage();
  await p.goto(BASE + "/pricing", { waitUntil: "networkidle" }); await p.waitForTimeout(800);
  const t = await p.$("[data-plans-toggle]"); await t.scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -40));
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/${P}pricing-1280-en-monthly.png` });
  await p.click("[data-plans-toggle] button:nth-of-type(2)");
  await p.waitForTimeout(150);
  await p.screenshot({ path: `${OUT}/${P}pricing-1280-en-mid-transition.png` });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/${P}pricing-1280-en-yearly-settled.png` });
  report.pricing = await p.evaluate(() => [...document.querySelectorAll("[data-swap]")].map((e) => e.getBoundingClientRect().height));
  await c.close();
}
{
  const c = await ctx(390, 844, "ku", true); const p = await c.newPage();
  await p.goto(BASE + "/pricing", { waitUntil: "networkidle" }); await p.waitForTimeout(500);
  await p.click("[data-plans-toggle] button:nth-of-type(2)"); await p.waitForTimeout(1300);
  await (await p.$("[data-plans-toggle]")).scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${OUT}/${P}pricing-390-ku-yearly.png` });
  await c.close();
}
console.log(JSON.stringify(report));
await b.close();
