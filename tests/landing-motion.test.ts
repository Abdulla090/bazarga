import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DmsVsBazarga } from "@/components/marketing/DmsVsBazarga";
import { splitWords, Words } from "@/components/marketing/reveal";

const LOCALES = ["en", "ku", "kmr", "ar"] as const;
const msgs = (l: string) => JSON.parse(readFileSync(`messages/${l}.json`, "utf8"));
const css = readFileSync("src/app/(marketing)/marketing.css", "utf8");
const page = readFileSync("src/app/(marketing)/page.tsx", "utf8");

describe("landing motion (Oct 18): one-time reveals", () => {
  it("hidden start states only apply under html[data-rv-on] + no-preference; nothing is scroll-linked", () => {
    const block = css.slice(css.indexOf("ONE-TIME REVEALS"), css.indexOf("Hero opening sequence"));
    for (const m of block.matchAll(/([^{}\n]*:not\(\[data-rv-in\]\)[^{]*)\{/g)) expect(m[1]).toContain("html[data-rv-on]");
    expect(block).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
    expect(block).toContain("cubic-bezier(0.16, 1, 0.3, 1)");
    expect(css).not.toContain("animation-timeline");
    expect(readFileSync("src/app/globals.css", "utf8")).not.toMatch(/hv-par[^\n]*animation-timeline/);
  });

  it("RTL mirrors the eyebrow slide", () => {
    expect(css).toMatch(/\[dir="rtl"\] \[data-rv="e"\]:not\(\[data-rv-in\]\) \{ transform: translate3d\(18px/);
  });

  it("hero title text is locked and only animated (ho-line spans)", () => {
    expect(msgs("en").landing.heroTitle1).toBe("Open your store today.");
    expect(msgs("en").landing.heroTitle2).toBe("Start free.");
    expect(msgs("ku").landing.heroTitle1).toBe("دوکانەکەت ئەمڕۆ بکەرەوە.");
    expect(msgs("ku").landing.heroTitle2).toBe("بە خۆڕایی دەستپێبکە.");
    expect(page).toContain('<span className="ho-line ho-line-1 block">{t("heroTitle1")}</span>');
    expect(page).toContain("<RevealObserver />");
    const hero = css.slice(css.indexOf("Hero opening sequence"));
    for (const d of [...hero.matchAll(/\.ho-(?:line-\d|media|chip)[^{]*\{[^}]*?(\d+)ms[^}]*\}/g)]) expect(Number(d[1])).toBeLessThanOrEqual(1100);
  });

  it("splitWords keeps Latin runs together in Arabic-script headings and leaves text unchanged", () => {
    expect(splitWords("Your posts sell. DMs lose the orders.")).toHaveLength(7);
    expect(splitWords("بە Reelcart Pro دەست پێبکە")).toEqual(["بە", "Reelcart Pro", "دەست", "پێبکە"]);
    for (const l of LOCALES) {
      const t = msgs(l).landing.dvb.title as string;
      const html = renderToStaticMarkup(createElement(Words, { text: t }));
      expect(html.replace(/<[^>]+>/g, "")).toBe(t.split(/\s+/).join(" "));
    }
  });
});

describe("DMs vs Reelcart: minimal", () => {
  it("same keys in every locale, no paragraphs, rows are 3-5 words", () => {
    const keys = Object.keys(msgs("en").landing.dvb).sort();
    expect(keys).toEqual(["bz1", "bz2", "bz3", "bz4", "bzTitle", "cta", "dm1", "dm2", "dm3", "dm4", "dmTitle", "eyebrow", "title"]);
    for (const l of LOCALES) {
      const d = msgs(l).landing.dvb;
      expect(Object.keys(d).sort(), l).toEqual(keys);
      for (const k of ["dm1", "dm2", "dm3", "dm4", "bz1", "bz2", "bz3", "bz4"]) {
        const n = (d[k] as string).split(/\s+/).length;
        expect(n, `${l}.${k}`).toBeGreaterThanOrEqual(2);
        expect(n, `${l}.${k}`).toBeLessThanOrEqual(5);
      }
    }
  });

  it("renders 4 × and 4 ✓ rows and a ≥44px CTA", () => {
    const d = msgs("ku").landing.dvb;
    const html = renderToStaticMarkup(createElement(DmsVsBazarga, { l: { eyebrow: d.eyebrow, title: d.title, dmTitle: d.dmTitle, dms: [d.dm1, d.dm2, d.dm3, d.dm4], bzTitle: d.bzTitle, bzs: [d.bz1, d.bz2, d.bz3, d.bz4], cta: d.cta } }));
    expect(html.match(/class="dvb-row"/g)?.length).toBe(8);
    expect(html).not.toContain("<p class=\"mt-4");
    expect(css).toMatch(/\.dvb-cta \{[^}]*min-height: 2\.75rem/);
  });
});

describe("no cultural / community references on the landing", () => {
  it("no ethnic or religious community names in any locale", () => {
    for (const l of LOCALES) {
      const raw = readFileSync(`messages/${l}.json`, "utf8");
      expect(raw, l).not.toMatch(/Assyr|Turkmen|Tirkmen|Aşûr|ئاشوور|تورکمان|آشور|التركمان|diaspora|diyaspor/i);
    }
  });
});
