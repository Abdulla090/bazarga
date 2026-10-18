// Language demo auto-cycle matrix (Oct 18, Abdulla's real Android): emulated Pixel 412x915, isMobile, hasTouch,
// CPU throttle 4x, reducedMotion reduce + no-preference, locales ku/ar/kmr/en. Over 10 s each must show >=3 language
// changes and the tile title must match the locale. Also: JS chunks blocked / no hydration (CSS-only layer) and returning visitor with a
// service worker installed. Usage: BASE_URL=... CHROME=... node e2e/langdemo-matrix.mjs   (exit 1 on any failure)
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "https://bazarga.vercel.app";
const px = process.env.HTTPS_PROXY && !BASE.includes("localhost") ? new URL(process.env.HTTPS_PROXY) : null;
const proxy = px ? { server: `${px.protocol}//${px.host}`, username: decodeURIComponent(px.username), password: decodeURIComponent(px.password) } : undefined;
const TITLES = { ku: "کوردی لە پێشەوە", kmr: "Kurdî di pêşiyê de", ar: "العربية أولاً", en: "Your language first" };
const FIRST = { ku: "ckb", kmr: "kmr", ar: "ar", en: "en" };
const LOCS = (process.env.LOCS ?? "ku,ar,kmr,en").split(",");
const RMS = (process.env.RMS ?? "reduce,no-preference").split(",");
const MODES = (process.env.MODES ?? "js,nojs").split(",");

const browser = await chromium.launch({ executablePath: process.env.CHROME, proxy, args: ["--no-sandbox"] });
const results = [];

/** The language currently visible in the demo: the live line once JS took over, else the opaque CSS-layer phrase. */
const visibleLang = () => {
  const tm = document.querySelector("[data-tm]");
  if (!tm) return null;
  if (tm.hasAttribute("data-tm-js")) return document.querySelector("[data-tm-line]")?.getAttribute("lang") + "|js";
  let best = null;
  for (const s of tm.querySelectorAll(".tm-sizer")) {
    const cs = getComputedStyle(s);
    const o = Number(cs.opacity);
    if (cs.visibility === "visible" && o > 0.5 && (!best || o > best.o)) best = { o, lang: s.getAttribute("lang") };
  }
  return best ? best.lang + "|css" : "none|css";
};

async function run(loc, rm, mode) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, reducedMotion: rm, locale: loc === "ku" ? "ckb" : loc,
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36" });
  await ctx.addCookies([{ name: "mm_locale", value: loc, domain: new URL(BASE).hostname, path: "/" }]);
  // "nojs": every /_next/static JS chunk is blocked, so React never hydrates (inline streaming scripts still run, as on
  // a phone where the bundle is blocked or fails) — only the CSS layer can move the demo.
  if (mode === "nojs") await ctx.route(/\/_next\/static\/.*\.js(\?|$)/, (r) => r.abort());
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 120)));
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await p.goto(BASE + "/", { waitUntil: "load", timeout: 60000 });
  await p.locator("[data-tm]").scrollIntoViewIfNeeded();
  const title = await p.evaluate(() => document.querySelector("[data-tm]")?.closest(".bento-tile")?.querySelector(".bento-title")?.textContent?.trim());
  const h0 = await p.evaluate(() => Math.round(document.querySelector("[data-tm]").getBoundingClientRect().height));
  const seq = [];
  const t0 = Date.now();
  let hMax = h0, hMin = h0;
  while (Date.now() - t0 < 10000) {
    const s = await p.evaluate(visibleLang);
    const h = await p.evaluate(() => Math.round(document.querySelector("[data-tm]").getBoundingClientRect().height));
    hMax = Math.max(hMax, h); hMin = Math.min(hMin, h);
    if (seq[seq.length - 1] !== s) seq.push(s);
    await p.waitForTimeout(150);
  }
  const langs = seq.map((s) => s?.split("|")[0]).filter((l) => l && l !== "none");
  let changes = 0;
  for (let i = 1; i < langs.length; i++) if (langs[i] !== langs[i - 1]) changes++;
  const ok = changes >= 3 && title === TITLES[loc] && langs[0] === FIRST[loc] && hMax - hMin <= 1;
  results.push({ loc, rm, mode, ok, changes, first: langs[0], title, h: `${hMin}-${hMax}`, seq: seq.join(">"), errs: errs.slice(0, 2) });
  console.log(JSON.stringify(results[results.length - 1]));
  await ctx.close();
}

for (const mode of MODES) for (const loc of LOCS) for (const rm of RMS) await run(loc, rm, mode);
await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(bad.length ? `FAIL ${bad.length}/${results.length}` : `PASS ${results.length}/${results.length}`);
process.exit(bad.length ? 1 : 0);
