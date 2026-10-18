// Returning visitor: PHASE=install visits the live site (previous deploy) with a persistent Android profile so its
// service worker + caches are installed; PHASE=check revisits after the new deploy and asserts the new code runs
// (new title, data-tm-js, >=3 language changes in 10 s) and the worker moved to the v2 caches.
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "https://bazarga.vercel.app";
const LOC = process.env.LOC ?? "ar";
const RM = process.env.RM ?? "reduce";
const DIR = process.env.PROFILE ?? `/tmp/langdemo-returning-${LOC}-${RM}`;
const px = process.env.HTTPS_PROXY && !BASE.includes("localhost") ? new URL(process.env.HTTPS_PROXY) : null;
const proxy = px ? { server: `${px.protocol}//${px.host}`, username: decodeURIComponent(px.username), password: decodeURIComponent(px.password) } : undefined;
const TITLES = { ku: "کوردی لە پێشەوە", kmr: "Kurdî di pêşiyê de", ar: "العربية أولاً", en: "Your language first" };

const ctx = await chromium.launchPersistentContext(DIR, { executablePath: process.env.CHROME, proxy, args: ["--no-sandbox"],
  viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, reducedMotion: RM,
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36" });
await ctx.addCookies([{ name: "mm_locale", value: LOC, domain: new URL(BASE).hostname, path: "/" }]);
const p = ctx.pages()[0] ?? (await ctx.newPage());
const cdp = await ctx.newCDPSession(p);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await p.goto(BASE + "/", { waitUntil: "load", timeout: 60000 });
const sw = async () => p.evaluate(async () => ({
  controlled: !!navigator.serviceWorker?.controller,
  caches: (await caches.keys()).filter((k) => k.startsWith("mm-")).sort().join(","),
}));
if (process.env.PHASE === "install") {
  await p.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 30000 }).catch(() => {});
  await p.reload({ waitUntil: "load" }); // second load goes through the worker and fills its caches
  await p.waitForTimeout(3000);
  console.log(JSON.stringify({ phase: "install", ...(await sw()) }));
  await ctx.close();
  process.exit(0);
}
await p.locator("[data-tm]").scrollIntoViewIfNeeded();
const title = await p.evaluate(() => document.querySelector("[data-tm]")?.closest(".bento-tile")?.querySelector(".bento-title")?.textContent?.trim());
const seq = [];
const t0 = Date.now();
while (Date.now() - t0 < 10000) {
  const l = await p.evaluate(() => (document.querySelector("[data-tm]")?.hasAttribute("data-tm-js") ? "js:" : "css:") + document.querySelector("[data-tm-line]")?.getAttribute("lang"));
  if (seq[seq.length - 1] !== l) seq.push(l);
  await p.waitForTimeout(150);
}
const js = seq.filter((s) => s.startsWith("js:"));
const state = await sw();
const ok = title === TITLES[LOC] && js.length >= 4 && state.caches.includes("-v2") && !state.caches.includes("-v1");
console.log(JSON.stringify({ phase: "check", LOC, RM, ok, title, changes: Math.max(0, js.length - 1), seq: seq.join(">"), ...state }));
await ctx.close();
process.exit(ok ? 0 : 1);
