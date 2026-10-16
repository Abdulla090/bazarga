// E2E audit matrix: every public + seller route × locales × widths, ~12 checks each.
//   BASE_URL=https://bazarga.vercel.app LOCALES=ku,ar OUT=/tmp/m.json node scripts/e2e-matrix.mjs
// Uses HTTPS_PROXY when set (sandbox egress). Writes one row per check: { route, locale, width, check, pass, detail }.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { auditInPage } from "../e2e/support.mjs";

const BASE = process.env.BASE_URL ?? "https://bazarga.vercel.app";
const SLUG = process.env.STORE_SLUG ?? "hawler-bazaar";
const LOCALES = (process.env.LOCALES ?? "ku,kmr,ar,en").split(",");
const WIDTHS = (process.env.WIDTHS ?? "360,390,1280").split(",").map(Number);
const OUT = process.env.OUT ?? "/tmp/e2e-matrix.json";
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const DEMO = { email: process.env.DEMO_EMAIL ?? "demo@mymarket.app", password: process.env.DEMO_PASSWORD ?? "mymarket-demo" };
const proxy = process.env.HTTPS_PROXY && !BASE.includes("localhost")
  ? (() => { const u = new URL(process.env.HTTPS_PROXY); return { server: `${u.protocol}//${u.host}`, username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) }; })()
  : undefined;
const AXE = readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const host = new URL(BASE).hostname;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium", proxy, args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });

// Discover a product, a category and an order-free route set from the live store.
const ctx0 = await browser.newContext();
const p0 = await ctx0.newPage();
await p0.goto(`${BASE}/s/${SLUG}`, { waitUntil: "domcontentloaded", timeout: 60000 });
const hrefs = await p0.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
const product = hrefs.find((h) => h && h.startsWith(`/s/${SLUG}/p/`));
const category = hrefs.find((h) => h && /[?&]c(at)?=/.test(h));
await ctx0.close();

const PUBLIC = [
  "/", "/pricing", "/showcase", "/login", "/signup", "/forgot-password", "/reset-password?token=matrix-not-a-token", "/verify-email",
  "/terms", "/privacy", "/refund", "/waitlist/MATRIXNOCODE",
  `/s/${SLUG}`, `/s/${SLUG}?offers=1`, `/s/${SLUG}?q=%D8%B9%D8%B3%D9%84`, ...(category ? [category] : []), ...(product ? [product] : []),
  `/s/${SLUG}/cart`, `/s/${SLUG}/track`, "/s/no-such-store-matrix", "/nope-404-matrix",
];
const DASH = ["/dashboard", "/dashboard/orders", "/dashboard/orders/courier", "/dashboard/products", "/dashboard/products/new", "/dashboard/categories",
  "/dashboard/customers", "/dashboard/delivery", "/dashboard/discounts", "/dashboard/analytics", "/dashboard/share", "/dashboard/theme",
  "/dashboard/settings", "/dashboard/upgrade", "/dashboard/payments", "/dashboard/ai", "/dashboard/more"];
const WITH_DASH = process.env.DASH !== "0";

const rows = [];
const add = (route, locale, width, check, pass, detail = "") => rows.push({ route, locale, width, check, pass: !!pass, detail: String(detail).slice(0, 400) });
const save = () => writeFileSync(OUT, JSON.stringify(rows));
const IGNORED_REQ = /favicon|google-analytics|googletagmanager|facebook|tiktok|connect\.facebook|analytics\.tiktok|_vercel\/insights|\/api\/v\//;

for (const locale of LOCALES) for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 800 ? 800 : 900 }, isMobile: width < 800, hasTouch: width < 800, deviceScaleFactor: width < 800 ? 2 : 1 });
  await ctx.addCookies([{ name: "mm_locale", value: locale, domain: host, path: "/" }]);
  const page = await ctx.newPage();
  const routes = PUBLIC.map((r) => ({ r, dash: false }));
  if (WITH_DASH) routes.push({ r: "__login__" }, ...DASH.map((r) => ({ r, dash: true })));
  let loggedIn = false;
  for (const { r, dash } of routes) {
    if (r === "__login__") {
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
      await page.locator('input[name="email"]').fill(DEMO.email);
      await page.locator('input[name="password"]').fill(DEMO.password);
      await page.locator("form button[type=submit], form button").last().click();
      loggedIn = await page.waitForURL(/dashboard|onboarding/, { timeout: 45000 }).then(() => true, () => false);
      add("/login(demo)", locale, width, "login", loggedIn);
      continue;
    }
    if (dash && !loggedIn) continue;
    if (ONLY && !ONLY.test(r)) continue;
    const errs = [];
    const failed = [];
    page.removeAllListeners("console"); page.removeAllListeners("pageerror"); page.removeAllListeners("response"); page.removeAllListeners("requestfailed");
    page.on("console", (m) => { if (m.type() === "error" && !/status of 404/.test(m.text())) errs.push(m.text().slice(0, 160)); });
    page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0, 160)));
    page.on("response", (res) => { if (res.status() >= 400 && !IGNORED_REQ.test(res.url()) && res.request().resourceType() !== "document") failed.push(`${res.status()} ${res.url().replace(BASE, "").slice(0, 100)}`); });
    page.on("requestfailed", (q) => { const t = q.failure()?.errorText ?? ""; if (!IGNORED_REQ.test(q.url()) && !/ERR_ABORTED/.test(t)) failed.push(`${t} ${q.url().replace(BASE, "").slice(0, 100)}`); });
    await page.addInitScript(() => {
      window.__cls = 0;
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch {}
    });
    let res;
    const t0 = Date.now();
    try { res = await page.goto(BASE + r, { waitUntil: "networkidle", timeout: 60000 }); }
    catch (e) { add(r, locale, width, "load", false, e.message.slice(0, 120)); continue; }
    const ms = Date.now() - t0;
    const exp404 = /no-such|nope-404|MATRIXNOCODE/.test(r);
    const st = res?.status() ?? 0;
    add(r, locale, width, "http-status", exp404 ? st === 404 || st === 200 : st < 400, `status ${st} ${ms}ms`);
    if (exp404) {
      const body = await page.locator("body").innerText();
      add(r, locale, width, "notfound-ui", /404|نەدۆزرایەوە|غير موجود|not found|nehat|نییە|لا توجد|ne hate dîtin/i.test(body) || (await page.locator("meta[name=robots][content*=noindex]").count()) > 0, body.slice(0, 80));
    }
    await page.waitForTimeout(400);
    const a = await page.evaluate(auditInPage, width);
    const d = await page.evaluate(() => {
      const text = document.body.innerText;
      const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && (i.currentSrc || i.src)).map((i) => (i.currentSrc || i.src).slice(0, 90));
      const rawKeys = [...new Set(text.match(/\b(common|nav|landing|pricing|dash|dashboard|store|auth|checkout|cart|footer|home|errors?|onboarding|settings|products?|orders?|share|theme|upgrade|admin|legal|track|meta|seo|faq|waitlist|showcase)\.[a-zA-Z0-9_.]+\b/g) || [])].slice(0, 6);
      const placeholders = [...new Set(text.match(/\{[a-zA-Z_]+\}|\bundefined\b|\bNaN\b|\[object Object\]|lorem ipsum|TODO|FIXME|MISSING_MESSAGE/gi) || [])].slice(0, 6);
      const deadLinks = [...document.querySelectorAll("a")].filter((l) => { const h = l.getAttribute("href"); return h === null || h === "" || h === "#"; }).filter((l) => !l.getAttribute("role")).map((l) => (l.innerText || l.getAttribute("aria-label") || "?").trim().slice(0, 30)).slice(0, 5);
      const imgsNoAlt = [...document.images].filter((i) => !i.hasAttribute("alt")).length;
      return { dir: document.documentElement.dir, lang: document.documentElement.lang, broken, rawKeys, placeholders, deadLinks, imgsNoAlt, cls: window.__cls ?? 0, title: document.title };
    });
    const wantDir = locale === "ku" || locale === "ar" ? "rtl" : "ltr";
    add(r, locale, width, "console-errors", errs.length === 0, [...new Set(errs)].slice(0, 3).join(" | "));
    add(r, locale, width, "failed-requests", failed.length === 0, [...new Set(failed)].slice(0, 4).join(" | "));
    add(r, locale, width, "broken-images", d.broken.length === 0, d.broken.join(", "));
    add(r, locale, width, "no-overflow", !a.overflow, `${a.scrollWidth}/${width} ${a.offenders.slice(0, 3).join(" ; ")}`);
    if (width < 800) add(r, locale, width, "tap-targets-44", a.smallTargetCount === 0, `${a.smallTargetCount}: ${a.smallTargets.slice(0, 6).join(" ; ")}`);
    if (width < 800) add(r, locale, width, "inputs-16px", a.smallInputs.length === 0, a.smallInputs.slice(0, 4).join(" ; "));
    add(r, locale, width, "dir-lang", exp404 || (d.dir === wantDir && d.lang.startsWith({ ku: "ckb", kmr: "kmr", ar: "ar", en: "en" }[locale])), `dir=${d.dir} lang=${d.lang}`);
    add(r, locale, width, "no-raw-keys", d.rawKeys.length === 0 && d.placeholders.length === 0, [...d.rawKeys, ...d.placeholders].join(", "));
    add(r, locale, width, "no-dead-links", d.deadLinks.length === 0, d.deadLinks.join(", "));
    add(r, locale, width, "title", d.title && d.title.length > 2 && !/undefined/.test(d.title), d.title);
    add(r, locale, width, "cls<0.1", d.cls < 0.1, d.cls.toFixed(3));
    add(r, locale, width, "load<8s", ms < 8000, `${ms}ms`);
    // axe once per route+locale at 390 and 1280 (360 is layout-identical for a11y rules)
    if (width !== 360) {
      await page.addScriptTag({ content: AXE }).catch(() => {});
      const v = await page.evaluate(async () => {
        if (!window.axe) return null;
        const r = await window.axe.run(document, { resultTypes: ["violations"], runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } });
        return r.violations.filter((x) => x.impact === "serious" || x.impact === "critical").map((x) => `${x.id}(${x.nodes.length}): ${x.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" , ")}`);
      }).catch((e) => [`axe-error ${e.message.slice(0, 60)}`]);
      if (v) add(r, locale, width, "axe-serious", v.length === 0, v.slice(0, 4).join(" | "));
    }
    save();
  }
  await ctx.close();
  console.log(`done ${locale} ${width}: ${rows.length} rows, ${rows.filter((x) => !x.pass).length} failing`);
}
await browser.close();
save();
console.log("TOTAL", rows.length, "FAIL", rows.filter((x) => !x.pass).length);
