import { expect, test } from "@playwright/test";

/**
 * Oct 18 (Abdulla, Android + Brave): FAQ answers did not open in Brave, the "Kurdish-first" language demo sat still,
 * and the phone menu needed a redesign.
 *  - Root cause: the FAQ was a React-state accordion (<button onClick → setState → data-open>). Its HTML had no native
 *    behaviour, so whenever the island had not hydrated (a chunk blocked/slow under Brave Shields, a tap landing before
 *    hydration on a slow phone) taps did nothing. It is now native <details>/<summary>: no JS needed to open.
 *  - These checks run the FAQ normally, with every JS chunk blocked (no hydration), with JS off (streamed segment
 *    unhidden by the harness), with localStorage/sessionStorage throwing, and with a Brave-like UA + navigator.brave +
 *    third-party scripts blocked.
 * Runs against a production build or the live site (playwright.live.config.mjs).
 */
const px = process.env.HTTPS_PROXY ? new URL(process.env.HTTPS_PROXY) : null;
const proxy = px ? { server: `${px.protocol}//${px.host}`, username: decodeURIComponent(px.username), password: decodeURIComponent(px.password) } : undefined;
const BRAVE_UA = "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

async function phone(browser, baseURL, { width = 412, locale = "ku", js = true, ua, reduced = false } = {}) {
  const host = new URL(baseURL).hostname;
  const context = await browser.newContext({
    ...(proxy && !/localhost|127\.0\.0\.1/.test(host) ? { proxy } : {}),
    viewport: { width, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, javaScriptEnabled: js,
    reducedMotion: reduced ? "reduce" : "no-preference", ...(ua ? { userAgent: ua } : {}),
  });
  await context.addCookies([{ name: "mm_locale", value: locale, domain: host, path: "/" }]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page, errors, host };
}

const throwStorage = () => {
  const t = () => { throw new DOMException("blocked", "SecurityError"); };
  Storage.prototype.getItem = t;
  Storage.prototype.setItem = t;
  try {
    Object.defineProperty(window, "localStorage", { get: t });
    Object.defineProperty(window, "sessionStorage", { get: t });
  } catch { /* ignore */ }
};

async function faqOpensAndCloses(page, { exclusive = true } = {}) {
  const first = page.locator("[data-faq] details").first();
  const sum = first.locator("summary");
  await sum.scrollIntoViewIfNeeded();
  await expect(first).not.toHaveAttribute("open", "");
  await sum.tap();
  await expect(first).toHaveAttribute("open", "");
  await expect(first.locator(".faq-a")).toBeVisible();
  if (!exclusive) {
    await sum.tap();
    await expect(first).not.toHaveAttribute("open", "");
    return;
  }
  // exclusive: opening the second closes the first
  const second = page.locator("[data-faq] details").nth(1);
  await second.locator("summary").tap();
  await expect(second).toHaveAttribute("open", "");
  await expect(first).not.toHaveAttribute("open", "");
  await second.locator("summary").tap();
  await expect(second).not.toHaveAttribute("open", "");
}

const MODES = {
  normal: {},
  "no hydration (all JS chunks blocked)": { route: (ctx) => ctx.route(/\/_next\/static\/chunks\/.*\.js(\?.*)?$/, (r) => r.abort()) },
  "storage throws": { init: throwStorage },
  "Brave UA + Shields-like blocking": {
    ua: BRAVE_UA,
    init: () => { Object.defineProperty(navigator, "brave", { value: { isBrave: () => Promise.resolve(true) } }); },
    route: (ctx, host) => ctx.route("**/*", (r) => { const u = new URL(r.request().url()); return (u.hostname !== host && r.request().resourceType() === "script") || /_vercel\/(insights|speed-insights)/.test(u.pathname) ? r.abort() : r.continue(); }),
    storage: true,
  },
};

for (const [name, m] of Object.entries(MODES)) {
  test(`FAQ opens and closes: ${name}`, async ({ browser, baseURL }) => {
    const { context, page, errors, host } = await phone(browser, baseURL, { ua: m.ua });
    if (m.init) await context.addInitScript(m.init);
    if (m.storage) await context.addInitScript(throwStorage);
    if (m.route) await m.route(context, host);
    await page.goto("/", { waitUntil: "networkidle" });
    await faqOpensAndCloses(page);
    if (name === "normal") expect(errors).toEqual([]);
    await context.close();
  });
}

test("FAQ opens with JavaScript disabled (native <details>)", async ({ browser, baseURL }) => {
  const { context, page } = await phone(browser, baseURL, { js: false });
  await page.goto("/", { waitUntil: "load" });
  // With JS off the streamed (cacheComponents) segments never swap in; unhide the FAQ's segment from the harness.
  await page.evaluate(() => { const seg = document.querySelector("[data-faq]")?.closest("div[hidden]"); if (seg) seg.hidden = false; });
  await faqOpensAndCloses(page, { exclusive: false });
  await context.close();
});

for (const reduced of [false, true]) {
  test(`language demo auto-cycles all 4 languages with a fixed height${reduced ? " (reduced motion: crossfade)" : ""}`, async ({ browser, baseURL }) => {
    test.setTimeout(90_000);
    const { context, page, errors } = await phone(browser, baseURL, { reduced });
    await page.goto("/", { waitUntil: "networkidle" });
    const tm = page.locator("[data-tm]");
    await tm.scrollIntoViewIfNeeded();
    // measure after the tile's one-time reveal (it rises from scale .96) has settled
    await expect(tm.locator("xpath=ancestor::*[@data-rv][1]")).toHaveAttribute("data-rv-done", "", { timeout: 6000 }).catch(() => {});
    const seen = new Set();
    const heights = new Set();
    for (let i = 0; i < 70 && seen.size < 4; i++) {
      const s = await page.evaluate(() => {
        const l = document.querySelector("[data-tm-line]");
        return { lang: l?.getAttribute("lang"), dir: l?.getAttribute("dir"), h: Math.round(document.querySelector("[data-tm]").getBoundingClientRect().height) };
      });
      seen.add(s.lang);
      heights.add(s.h);
      expect(s.dir).toBe(s.lang === "ckb" || s.lang === "ar" ? "rtl" : "ltr");
      await page.waitForTimeout(500);
    }
    expect([...seen].sort()).toEqual(["ar", "ckb", "en", "kmr"]);
    expect(heights.size, `tile height changed: ${[...heights]}`).toBe(1);
    expect(errors).toEqual([]);
    await context.close();
  });
}

for (const [width, locale, side] of [[412, "ku", "left"], [360, "ar", "left"], [412, "en", "right"]]) {
  test(`${width} ${locale}: sheet slides from the ${side}, closes on scrim, Esc, X and navigation, no overflow`, async ({ browser, baseURL }) => {
    const { context, page, errors } = await phone(browser, baseURL, { width, locale });
    await page.goto("/", { waitUntil: "networkidle" });
    const btn = page.locator("[data-nav-menu-button]");
    const open = () => page.evaluate(() => [...document.querySelectorAll("[data-mobile-sheet]")].some((e) => e.matches(":popover-open")));
    await btn.tap();
    await page.waitForTimeout(700);
    expect(await open()).toBe(true);
    await expect(btn).toHaveAttribute("aria-expanded", "true");
    const r = await page.evaluate(() => { const b = document.querySelector(".mm-panel").getBoundingClientRect(); return { x: b.x, right: b.right, iw: innerWidth, sw: document.scrollingElement.scrollWidth, ov: getComputedStyle(document.documentElement).overflow }; });
    expect(side === "left" ? r.x : r.iw - r.right).toBeLessThanOrEqual(1);
    expect(r.sw).toBeLessThanOrEqual(r.iw);
    expect(r.ov).toBe("hidden");
    const small = await page.locator(".mm-panel a, .mm-panel button").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length);
    expect(small).toBe(0);
    await page.touchscreen.tap(side === "left" ? width - 20 : 20, 600);
    await page.waitForTimeout(600);
    expect(await open()).toBe(false);
    await btn.tap(); await page.waitForTimeout(600);
    await page.keyboard.press("Escape"); await page.waitForTimeout(600);
    expect(await open()).toBe(false);
    await btn.tap(); await page.waitForTimeout(600);
    await btn.tap(); await page.waitForTimeout(600);
    expect(await open()).toBe(false);
    await btn.tap(); await page.waitForTimeout(600);
    await page.locator('.mm-panel a[href="/pricing"]').tap();
    await page.waitForURL("**/pricing");
    await page.waitForTimeout(600);
    expect(await open()).toBe(false);
    expect(errors).toEqual([]);
    await context.close();
  });
}
