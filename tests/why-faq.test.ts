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
  "whyLead", "whyChatName", "whyChatMsg", "whyCardBadge", "whyCardCta", "whyPayLabel", "whySoon", "whyDeliveryLabel", "whyMapLabel",
  "cityBerlin", "cityStockholm", "cityLondon", "whoLead", "faqEyebrow", "faqTitle", "faqLead", "faqMore",
  ...Array.from({ length: 12 }, (_, i) => `c${i + 1}`),
];

describe("landing FAQ accordion", () => {
  const items = FAQ.map((k) => msgs("en").landing.faq[k]);

  it("renders real buttons with aria-expanded/aria-controls and labelled regions", () => {
    const html = renderToStaticMarkup(createElement(FaqList, { items }));
    expect(html.match(/<button[^>]*type="button"/g)?.length).toBe(8);
    expect(html.match(/aria-expanded="false"/g)?.length).toBe(8);
    const controls = [...html.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);
    const regions = [...html.matchAll(/<div id="([^"]+)" role="region" aria-labelledby="([^"]+)"/g)];
    expect(regions.map((m) => m[1])).toEqual(controls);
    const btnIds = [...html.matchAll(/<button[^>]*id="([^"]+)"/g)].map((m) => m[1]);
    expect(regions.map((m) => m[2])).toEqual(btnIds);
    expect(html).toContain("<h3");
  });

  it("only the open item is expanded", () => {
    const html = renderToStaticMarkup(createElement(FaqList, { items, initialOpen: 2 }));
    expect(html.match(/aria-expanded="true"/g)?.length).toBe(1);
    expect(html.match(/role="region"[^>]*data-open="true"/g)?.length).toBe(1);
  });

  it("single-open toggle rule", () => {
    expect(toggleFaq(null, 3)).toBe(3);
    expect(toggleFaq(3, 3)).toBeNull();
    expect(toggleFaq(3, 5)).toBe(5);
  });

  it("the open animation ends sharp: blur(0) + scale(1), spring easing, reduced motion static", () => {
    const css = readFileSync("src/app/(marketing)/marketing.css", "utf8");
    const open = css.slice(css.indexOf(".faq-panel[data-open] .faq-a {"));
    expect(open.slice(0, 300)).toMatch(/filter: blur\(0\)/);
    expect(open.slice(0, 300)).toMatch(/transform: scale\(1\)/);
    expect(css).toContain("cubic-bezier(0.32, 0.72, 0, 1)");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[^}]*\.faq-panel/);
    // every blur keyframe/end state that animates in returns to blur(0)
    for (const kf of ["bento-in", "zs-s4"]) {
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
      w3Title: m.w3Title, w3Body: m.w3Body, w4Title: m.w4Title, w4Body: m.w4Body,
      chatName: m.whyChatName, chatMsg: m.whyChatMsg, cardBadge: m.whyCardBadge, cardCta: m.whyCardCta,
      payLabel: m.whyPayLabel, soon: m.whySoon, deliveryLabel: m.whyDeliveryLabel, mapLabel: m.whyMapLabel,
      berlin: m.cityBerlin, stockholm: m.cityStockholm, london: m.cityLondon, productName: "Linen overshirt",
    };
  };

  it("why bento renders 4 tiles with live visuals (no generic glyph circles) in every locale", () => {
    for (const l of LOCALES) {
      const html = renderToStaticMarkup(createElement(WhyBento, { locale: l, l: labels(l) }));
      expect(html.match(/class="bento-tile/g)?.length).toBe(4);
      for (const p of ["COD", "FIB", "ZainCash", "FastPay", "Qi Card"]) expect(html).toContain(p);
      expect(html).toContain('class="map-dots"');
      expect(html).toContain('dir="rtl"'); // Sorani/Arabic typewriter lines carry their own direction
      expect(html).not.toContain("bg-gold");
    }
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
