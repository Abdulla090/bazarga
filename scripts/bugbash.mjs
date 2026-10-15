import { chromium } from "/workspace/work/bazarga/node_modules/playwright/index.mjs";
const BASE = process.env.BASE_URL ?? "https://bazarga.vercel.app";
const proxy = process.env.HTTPS_PROXY ? (() => { const u = new URL(process.env.HTTPS_PROXY); return { server: `${u.protocol}//${u.host}`, username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) }; })() : undefined;
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", proxy, args: ["--no-sandbox","--disable-dev-shm-usage","--disable-gpu"] });
const host = new URL(BASE).hostname;
// discover product + other store routes
const ctx0 = await browser.newContext(); const p0 = await ctx0.newPage();
await p0.goto(BASE + "/s/hawler-bazaar", { waitUntil: "networkidle" });
const links = await p0.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
const product = links.find((h) => /^\/s\/hawler-bazaar\/p\//.test(h)) ?? links.find((h) => /\/p\//.test(h));
console.log("product link:", product, links.filter(h=>h.startsWith("/s/")).slice(0,12).join(" "));
await ctx0.close();
const routes = ["/", "/pricing", "/login", "/signup", "/forgot-password", "/terms", "/privacy", "/refund", "/s/hawler-bazaar", "/s/hawler-bazaar/cart", "/s/hawler-bazaar/track", "/s/no-such-store", "/nope-404", ...(product ? [product] : [])];
const dash = ["/dashboard","/dashboard/orders","/dashboard/orders/courier","/dashboard/products","/dashboard/products/new","/dashboard/categories","/dashboard/customers","/dashboard/delivery","/dashboard/discounts","/dashboard/analytics","/dashboard/share","/dashboard/theme","/dashboard/settings","/dashboard/upgrade","/dashboard/payments","/dashboard/ai","/dashboard/more"];
const widths = [[360, 800], [390, 844], [1280, 800]];
const issues = [];
for (const locale of ["ku", "kmr", "ar", "en"]) for (const [w, h] of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addCookies([{ name: "mm_locale", value: locale, domain: host, path: "/" }]);
  const page = await ctx.newPage();
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.locator('input[name="email"]').fill("demo@mymarket.app"); await page.locator('input[name="password"]').fill("mymarket-demo");
  await page.locator("form button").last().click();
  await page.waitForURL(/dashboard|onboarding/, { timeout: 30000 }).catch(() => issues.push(`${locale} ${w} login failed`));
  for (const r of [...routes, ...dash]) {
    const errs = [];
    page.removeAllListeners("console"); page.removeAllListeners("pageerror"); page.removeAllListeners("response");
    page.on("console", (m) => { if (m.type() === "error") errs.push("console:" + m.text().slice(0, 120)); });
    page.on("pageerror", (e) => errs.push("pageerror:" + e.message.slice(0, 120)));
    page.on("response", (res) => { if (res.status() >= 400 && !res.url().includes("favicon")) errs.push(`http${res.status()}:${res.url().slice(0, 90)}`); });
    let res; try { res = await page.goto(BASE + r, { waitUntil: "networkidle", timeout: 45000 }); } catch (e) { issues.push(`${locale} ${w} ${r}: goto fail ${e.message.slice(0,60)}`); continue; }
    const st = res?.status();
    const exp404 = r.includes("no-such") || r.includes("nope");
    if (exp404 ? st !== 404 : st >= 400) issues.push(`${locale} ${w} ${r}: status ${st}`);
    const d = await page.evaluate(() => {
      const se = document.scrollingElement;
      const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc).map((i) => i.currentSrc.slice(0, 80));
      const text = document.body.innerText;
      const rawKeys = (text.match(/\b[a-z][a-zA-Z]+\.[a-z][a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*\b/g) || []).filter((k) => /^(common|nav|landing|pricing|dash|store|auth|checkout|cart|footer|home|errors?)\./.test(k)).slice(0, 5);
      const small = [...document.querySelectorAll("a,button,input,select,textarea,summary")].filter((e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && (b.height < 40 || b.width < 40) && !(e.tagName === "A" && e.closest("p,li,span") && e.parentElement && e.parentElement.childNodes.length > 1) && e.type !== "hidden" && e.type !== "checkbox" && e.type !== "radio"; }).map((e) => (e.innerText || e.getAttribute("aria-label") || e.tagName).trim().slice(0, 24) + `@${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`).slice(0, 6);
      return { sw: se.scrollWidth, iw: innerWidth, broken, rawKeys, small, dir: document.documentElement.dir, lang: document.documentElement.lang };
    });
    if (d.sw > d.iw) issues.push(`${locale} ${w} ${r}: overflow ${d.sw}>${d.iw}`);
    if (d.broken.length) issues.push(`${locale} ${w} ${r}: broken imgs ${d.broken.join(",")}`);
    if (d.rawKeys.length) issues.push(`${locale} ${w} ${r}: raw keys ${d.rawKeys.join(",")}`);
    const wantDir = locale === "ku" || locale === "ar" ? "rtl" : "ltr";
    if (d.dir !== wantDir && !exp404) issues.push(`${locale} ${w} ${r}: dir ${d.dir}`);
    const e2 = errs.filter((e) => !(exp404 && e.startsWith("http404")) && !e.includes("Failed to load resource: the server responded with a status of 404") || !exp404 && e.startsWith("console:Failed"));
    if (e2.length) issues.push(`${locale} ${w} ${r}: ${[...new Set(e2)].slice(0, 3).join(" ; ")}`);
    if (w === 390 && d.small.length) issues.push(`${locale} ${w} ${r}: small targets ${d.small.join(", ")}`);
  }
  await ctx.close();
}
await browser.close();
console.log(issues.length ? issues.join("\n") : "NO ISSUES"); console.log("total", issues.length);
