import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }) }));
vi.mock("@/server/actions/locale", () => ({ setLocaleAction: async () => {} }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (k: string, v?: Record<string, unknown>) => (v ? `${k}:${JSON.stringify(v)}` : k),
}));

const { SiteHeaderView } = await import("@/components/SiteHeader");
const { HeroVisual } = await import("@/components/marketing/HeroVisual");
const { HeroCta, HeroHook } = await import("@/components/marketing/HeroCta");

const LOCALES = ["en", "ku", "kmr", "ar"] as const;
const msgs = (l: string) => JSON.parse(readFileSync(`messages/${l}.json`, "utf8"));
const labels = (l: string) => {
  const m = msgs(l);
  return { ...m.nav, pricing: m.pricing.nav };
};
const header = (l: (typeof LOCALES)[number], signedIn = false) =>
  renderToStaticMarkup(createElement(SiteHeaderView, { labels: labels(l), locale: l, signedIn }));

describe("marketing header: one clean row", () => {
  it("has no promo top bar and never repeats the hero's $1 offer", () => {
    for (const l of LOCALES) {
      const html = header(l);
      expect(html).not.toContain("$1");
      expect(html).not.toContain(msgs(l).pricing.bar);
      expect(html).not.toContain(msgs(l).pricing.barCta);
      expect(html).toContain("data-site-top");
    }
  });

  it("shows logo, at most 4 links, one compact language control, one quiet Log in and one CTA", () => {
    const html = header("en");
    const nav = html.slice(html.indexOf("data-nav-links"), html.indexOf("</nav>"));
    const links = nav.match(/<a /g)?.length ?? 0;
    expect(links).toBeGreaterThanOrEqual(3);
    expect(links).toBeLessThanOrEqual(4);
    expect(html.match(/data-locale-menu/g)?.length).toBe(1);
    expect(html.match(/data-nav-login/g)?.length).toBe(1);
    expect(html.match(/data-nav-cta/g)?.length).toBe(1);
    expect(html).toContain('href="/signup"');
    expect(html).toContain("Start free");
    expect(html).toContain("data-nav-menu-button");
    // the old row of language pills is gone from the header bar
    expect(html).not.toContain('role="group" aria-label="Language"');
  });

  it("signed in: no Log in, the CTA goes to the dashboard", () => {
    const html = header("en", true);
    expect(html).not.toContain("data-nav-login");
    expect(html).toContain('href="/dashboard"');
  });

  it("every locale has the new nav copy", () => {
    for (const l of LOCALES) for (const k of ["start", "how", "demo", "menu", "close", "language", "main"]) expect(msgs(l).nav[k], `${l}.nav.${k}`).toBeTruthy();
  });

  it("/ and /pricing use the same SiteHeader", () => {
    for (const p of ["src/app/(marketing)/page.tsx", "src/app/(marketing)/pricing/page.tsx"]) {
      const src = readFileSync(p, "utf8");
      expect(src).toContain('import { SiteHeader } from "@/components/SiteHeader"');
      expect(src).toContain("<SiteHeader />");
      expect(src).not.toContain("AnnouncementBar");
    }
  });
});

describe("hero phone cards: hidden until scroll, aria-safe", () => {
  it("renders with data-reveal=off, both cards wrapped for the reveal, all decorative content aria-hidden", async () => {
    const html = renderToStaticMarkup(await HeroVisual({ locale: "en" }));
    expect(html).toMatch(/role="img"[^>]*data-hv="[^"]*"[^>]*data-reveal="off"/);
    expect(html.match(/data-reveal-card="/g)?.length).toBe(2);
    // every reveal card lives inside the aria-hidden stage, so hidden cards never reach assistive tech
    const stage = html.indexOf('aria-hidden="true" class="relative mx-auto');
    expect(stage).toBeGreaterThan(-1);
    for (const m of html.matchAll(/data-reveal-card="/g)) expect(m.index!).toBeGreaterThan(stage);
    expect(html).toContain("<noscript>");
  });

  it("CSS hides the cards fully (opacity 0 + visibility hidden) and ends sharp (blur(0)), reduced motion shows them", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const off = css.slice(css.indexOf('[data-hv][data-reveal="off"] .hv-reveal,'));
    expect(off).toMatch(/opacity: 0;\s+visibility: hidden;/);
    expect(css).toMatch(/\.hv-reveal \{ filter: blur\(0\); transform: none; \}/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s+\[data-hv\] \.hv-reveal[^}]+filter: none !important/);
  });
});

describe("hero: blue headline hook + restrained CTA", () => {
  it("CTA is a clean ≥48px ink link with a direction-aware arrow and no heatmap/rotating border", () => {
    const html = renderToStaticMarkup(createElement(HeroCta, { href: "/signup", label: "Create your store free" }));
    expect(html).toContain('href="/signup"');
    expect(html).toContain("cta-hook");
    expect(html).not.toContain("cta-heat");
    expect(html).not.toContain("<i ");
    expect(html).toContain("rtl:-scale-x-100");
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/\.cta-hook \{[^}]*min-height: 3rem/);
    expect(css).toMatch(/\.cta-hook \{[^}]*background: var\(--color-ink\)/);
    expect(css).not.toMatch(/cta-heat|cta-spin|--cta-a/);
  });

  it("headline line 2 is a crisp blue gradient-text hook with a decorative underline, no blur/glow", () => {
    const html = renderToStaticMarkup(createElement(HeroHook, { text: "Start free." }));
    expect(html).toContain("Start free.");
    expect(html).toMatch(/<svg aria-hidden="true"[^>]*class="hero-hook-line"/);
    const css = readFileSync("src/app/globals.css", "utf8");
    const block = css.slice(css.indexOf("Hero headline line 2"), css.indexOf("@media (forced-colors: active)", css.indexOf("Hero headline line 2")));
    expect(block).toMatch(/background-clip: text/);
    expect(block).toMatch(/#2563eb/i);
    expect(block).not.toMatch(/blur\(|text-shadow|drop-shadow/);
    // reduced motion => static gradient: animations only live under no-preference
    expect(block).toMatch(/prefers-reduced-motion: no-preference\) \{\s+\.hero-hook-text \{ animation/);
  });

  it("landing page wires the hook into the H1, keeps the free micro-line under the CTA and pushes the phone lower", () => {
    const src = readFileSync("src/app/(marketing)/page.tsx", "utf8");
    expect(src).toContain('<HeroHook text={t("heroTitle2")} />');
    expect(src).toContain('<HeroCta href="/signup"');
    expect(src.indexOf("<HeroCta")).toBeLessThan(src.indexOf("data-hero-note"));
    expect(src).toContain("data-hero-promo");
    expect(src).toMatch(/data-hero-phone className="[^"]*mt-10[^"]*sm:mt-\[5\.5rem\]/);
  });

  it("header is a 3-column grid with the links centred", () => {
    const html = header("en");
    expect(html).toContain("md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]");
    expect(html).toMatch(/data-nav-links|md:justify-self-center/);
    expect(html).toContain("md:justify-self-center");
    expect(html).toContain("md:justify-self-end");
  });
});
