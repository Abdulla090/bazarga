import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FaqList, toggleFaq } from "@/components/marketing/FaqList";
import { WhyBento, type WhyLabels } from "@/components/marketing/WhyBento";
import { WhoMarquee } from "@/components/marketing/WhoMarquee";
import { PLANS, FREE_PRODUCT_LIMIT, PRO_FIRST_MONTH, getPlan } from "@/lib/plans";

const LOCALES = ["en", "ku", "kmr", "ar"] as const;
const msgs = (l: string) => JSON.parse(readFileSync(`messages/${l}.json`, "utf8"));
const FAQ = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"];
const NEW_KEYS = [
  "whyLead", "whyChatName", "whyChatMsg", "whyCardBadge", "whyCardCta", "whyPayLabel", "whySoon", "whyDeliveryLabel",
  "whoLead", "faqEyebrow", "faqTitle", "faqLead", "faqMore",
  ...Array.from({ length: 12 }, (_, i) => `c${i + 1}`),
];

describe("landing FAQ accordion", () => {
  const items = FAQ.map((k) => msgs("en").landing.faq[k]);

  it("is native <details>/<summary>: opens with no JS, one shared name (exclusive), heading inside the summary", () => {
    const html = renderToStaticMarkup(createElement(FaqList, { items }));
    expect(html.match(/<details[^>]*class="faq-item"/g)?.length).toBe(8);
    expect(html.match(/<summary class="faq-btn"><h3 class="faq-q">/g)?.length).toBe(8);
    const names = [...html.matchAll(/<details[^>]*name="([^"]+)"/g)].map((m) => m[1]);
    expect(names.length).toBe(8);
    expect(new Set(names).size).toBe(1);
    // nothing JS-only: no buttons, no aria-expanded state to keep in sync, nothing open by default
    expect(html).not.toContain("<button");
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toMatch(/<details[^>]* open/);
    const src = readFileSync("src/components/marketing/FaqList.tsx", "utf8");
    expect(src).not.toMatch(/useState|onClick|onToggle|localStorage|sessionStorage/);
  });

  it("initialOpen renders exactly one item open", () => {
    const html = renderToStaticMarkup(createElement(FaqList, { items, initialOpen: 2 }));
    expect(html.match(/<details[^>]*open=""/g)?.length).toBe(1);
  });

  it("single-open toggle rule", () => {
    expect(toggleFaq(null, 3)).toBe(3);
    expect(toggleFaq(3, 3)).toBeNull();
    expect(toggleFaq(3, 5)).toBe(5);
  });

  it("the open animation is CSS only, ends sharp, and can never leave an answer hidden", () => {
    const css = readFileSync("src/app/(marketing)/marketing.css", "utf8");
    const rest = css.slice(css.indexOf(".faq-a {"), css.indexOf(".faq-a {") + 500);
    expect(rest).toMatch(/opacity: 1/);
    expect(rest).toMatch(/filter: blur\(0\)/);
    expect(rest).toMatch(/transform: scale\(1\)/);
    // the hidden genie start only exists as @starting-style on an [open] item
    expect(css).toMatch(/@starting-style \{\s*\.faq-item\[open\] \.faq-a \{ opacity: 0/);
    expect(css).toMatch(/\.faq-item\[open\]::details-content \{ block-size: auto/);
    expect(css).toContain("interpolate-size: allow-keywords");
    // no pointer-events:none / visibility:hidden anywhere in the FAQ rules; the reveal can't clip it
    const faq = css.slice(css.indexOf(".faq {"), css.indexOf("@media (prefers-reduced-motion: reduce) {\n  .faq-item"));
    expect(faq).not.toMatch(/pointer-events:\s*none|visibility:\s*hidden/);
    expect(css).toContain("[data-rv]:has(> [data-faq]) { clip-path: none !important; pointer-events: auto !important; }");
    expect(css).toContain("cubic-bezier(0.32, 0.72, 0, 1)");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[^}]*\.faq-item::details-content/);
    for (const kf of ["zs-s4", "hero-in-line", "hero-in-media"]) {
      const block = css.slice(css.indexOf(`@keyframes ${kf}`), css.indexOf(`@keyframes ${kf}`) + 400);
      expect(block).toContain("blur(0)");
    }
  });

  it("answers agree with src/lib/plans.ts", () => {
    const en = msgs("en").landing.faq;
    expect(en.q1.a).toContain(String(FREE_PRODUCT_LIMIT));
    const pro = getPlan("pro");
    expect(en.q2.a).toContain(`$${PRO_FIRST_MONTH}`);
    expect(en.q2.a).toContain(`$${pro.monthly}`);
    expect(en.q2.a).toContain(`$${pro.yearly}`);
    expect(en.q5.a).toContain(`$${getPlan("business").monthly}`);
    expect(PLANS.length).toBe(4);
    for (const l of LOCALES) {
      const f = msgs(l).landing.faq;
      expect(f.q1.a).toContain(String(FREE_PRODUCT_LIMIT));
      expect(f.q2.a).toMatch(/\$1\b/);
      expect(f.q2.a).toContain(`$${pro.monthly}`);
      expect(f.q2.a).toContain(`$${pro.yearly}`);
      expect(f.q5.a).toContain(`$${getPlan("business").monthly}`);
      for (const p of ["FIB", "ZainCash", "FastPay", "Qi"]) expect(f.q3.a).toContain(p);
    }
  });
});

describe("landing locale keys", () => {
  it("every new landing key + all 8 FAQs exist and are non-empty in all 4 locales", () => {
    for (const l of LOCALES) {
      const m = msgs(l).landing;
      for (const k of NEW_KEYS) expect(typeof m[k] === "string" && m[k].length > 0, `${l}.landing.${k}`).toBe(true);
      for (const k of FAQ) {
        expect(m.faq[k].q.length, `${l} ${k}.q`).toBeGreaterThan(5);
        expect(m.faq[k].a.length, `${l} ${k}.a`).toBeGreaterThan(20);
      }
    }
  });
  it("Kurmanji stays Latin, Sorani/Arabic stay Arabic-script", () => {
    for (const k of FAQ) {
      expect(msgs("kmr").landing.faq[k].q).not.toMatch(/[\u0600-\u06FF]/);
      expect(msgs("ku").landing.faq[k].q).toMatch(/[\u0600-\u06FF]/);
      expect(msgs("ar").landing.faq[k].q).toMatch(/[\u0600-\u06FF]/);
    }
  });
});

describe("marketing sections are blue + ink only", () => {
  const FILES = [
    "src/app/(marketing)/page.tsx",
    "src/app/(marketing)/marketing.css",
    "src/components/marketing/WhyBento.tsx",
    "src/components/marketing/WhoMarquee.tsx",
    "src/components/marketing/FaqList.tsx",
    "src/components/marketing/TypeMorph.tsx",
  ];
  it("no green/orange/yellow classes or the old green eyebrow", () => {
    for (const f of FILES) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/\b(text|bg|border|ring|fill|stroke)-(green|emerald|lime|orange|amber|yellow)\b/);
      expect(src, f).not.toMatch(/--color-green|#1f8a5b|#1a7a50/i);
      expect(src, f).not.toMatch(/className="eyebrow"/);
    }
  });

  const labels = (l: (typeof LOCALES)[number]): WhyLabels => {
    const m = msgs(l).landing;
    return {
      eyebrow: m.whyEyebrow, title: m.whyTitle, lead: m.whyLead,
      w1Title: m.w1Title, w1Body: m.w1Body, w2Title: m.w2Title, w2Body: m.w2Body,
      w3Title: m.w3Title, w3Body: m.w3Body,
      chatName: m.whyChatName, chatMsg: m.whyChatMsg, cardBadge: m.whyCardBadge, cardCta: m.whyCardCta,
      payLabel: m.whyPayLabel, soon: m.whySoon, deliveryLabel: m.whyDeliveryLabel,
      productName: "Linen overshirt",
    };
  };

  it("why bento renders 3 tiles with live visuals, light band, no map, in every locale", () => {
    for (const l of LOCALES) {
      const html = renderToStaticMarkup(createElement(WhyBento, { locale: l, l: labels(l) }));
      expect(html.match(/class="bento-tile/g)?.length).toBe(3);
      for (const p of ["COD", "FIB", "ZainCash", "FastPay", "Qi Card"]) expect(html).toContain(p);
      expect(html).not.toContain("map-");
      expect(html).not.toContain("mk-eyebrow-dark");
      // the typewriter line carries its own direction (Sorani/Arabic rtl, English/Kurmanji ltr)
      expect(html).toMatch(new RegExp(`dir="${l === "ku" || l === "ar" ? "rtl" : "ltr"}" class="tm-line tm-live"`));
      // fixed height: all 4 phrases are laid out invisibly in the same cell
      expect(html.match(/class="tm-line tm-sizer" aria-hidden="true"/g)?.length).toBe(4);
      // the demo starts on the visitor's own language (first sizer + the live line), then the others
      const firstLang = { ku: "ckb", kmr: "kmr", ar: "ar", en: "en" }[l];
      expect(html).toMatch(new RegExp(`<p lang="${firstLang}"[^>]*class="tm-line tm-sizer"[^>]*style="--k:0"`));
      expect(html).toMatch(new RegExp(`<p lang="${firstLang}"[^>]*class="tm-line tm-live"`));
      expect(html).not.toContain("bg-gold");
      // language demo: one compact dropdown, not a row of 4 chips
      expect(html).not.toContain("tm-tab");
      expect(html.match(/data-lang-dropdown/g)?.length).toBe(1);
      expect(html).toContain('aria-haspopup="menu"');
    }
  });

  it("Sorani Why copy reads naturally (Oct 15 review) and every locale has the demo picker label", () => {
    const ku = msgs("ku").landing;
    expect(ku.whyEyebrow).toBe("بۆچی Reelcart؟");
    expect(msgs("ar").landing.whyEyebrow).toBe("لماذا Reelcart؟");
    for (const l of LOCALES) expect(msgs(l).landing.whyEyebrow, l).toContain("Reelcart");
    expect(ku.whyTitle).toBe("بۆ بازاڕی ئێمە دروستکراوە.");
    expect(ku.whyLead).toContain("بەپێی شێوازی فرۆشتنی خەڵکی ئێرە");
    expect(ku.w1Title).toBe("کوردی لە پێشەوە");
    // Oct 18: "your language first" — the tile title/body follow the visitor's locale, one short line, no rivals line.
    expect(ku.w1Body).toBe("سۆرانی، کرمانجی، عەرەبی و ئینگلیزی — هەمووی ئامادەیە.");
    expect(msgs("ar").landing.w1Title).toBe("العربية أولاً");
    expect(msgs("en").landing.w1Title).toBe("Your language first");
    expect(msgs("kmr").landing.w1Title).toBe("Kurdî di pêşiyê de");
    expect(msgs("ar").landing.w1Body).not.toMatch(/المنافس/);
    for (const l of LOCALES) {
      expect(msgs(l).landing.w1Title, l).toBeTruthy();
      expect(msgs(l).landing.w1Body.length, l).toBeLessThan(80);
      expect(msgs(l).landing.w1Body, l).not.toMatch(/Rivals|Reqîb|المنافس/);
    }
    for (const l of LOCALES) expect(msgs(l).landing.whyLangPick, l).toBeTruthy();
  });

  it("who marquee: 12 chips, filler copy hidden from assistive tech", () => {
    const m = msgs("ku").landing;
    const cats = Array.from({ length: 12 }, (_, i) => m[`c${i + 1}`]);
    const html = renderToStaticMarkup(createElement(WhoMarquee, { l: { eyebrow: m.whoEyebrow, title: m.whoTitle, lead: m.whoLead, cats } }));
    expect(html.match(/class="who-chip"/g)?.length).toBe(48);
    expect(html.match(/class="who-chip" data-copy="0"/g)?.length).toBe(12);
    expect(html.match(/aria-hidden="true" data-copy="[123]"/g)?.length).toBe(36);
  });
});

describe("language demo auto-cycle (Oct 18, real Android)", () => {
  const src = readFileSync("src/components/marketing/TypeMorph.tsx", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  const css = readFileSync("src/app/(marketing)/marketing.css", "utf8");
  it("JS cycle is a plain interval with no reveal/animation-event/reduced-motion gating", () => {
    expect(src).toMatch(/setInterval\(advance, TM\.step\)/);
    expect(src).not.toMatch(/data-rv|animationend|transitionend|MutationObserver/);
    expect(src).not.toMatch(/if \(reduced\) return/);
  });
  it("CSS fallback cycles the phrases before/without hydration and survives the reduced-motion clamp", () => {
    expect(css).toMatch(/\.tm:not\(\[data-tm-js\]\) \.tm-sizer \{[^}]*tm-cycle 12s linear infinite !important/);
    expect(css).toMatch(/animation-iteration-count: infinite !important/);
  });
});
