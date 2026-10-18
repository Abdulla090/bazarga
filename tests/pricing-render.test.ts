import { readFileSync } from "node:fs";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { PricingPlans } from "@/components/pricing/PricingPlans";
import { PromoPrice } from "@/components/pricing/PromoPrice";

const LOCALES = ["en", "ku", "kmr", "ar"] as const;
const msgs = (l: string) => JSON.parse(readFileSync(`messages/${l}.json`, "utf8"));
const render = (l: string, props: ComponentProps<typeof PricingPlans> = {}) =>
  renderToStaticMarkup(createElement(
    NextIntlClientProvider,
    { locale: l, messages: msgs(l), timeZone: "Asia/Baghdad" } as ComponentProps<typeof NextIntlClientProvider>,
    createElement(PricingPlans, props),
  ));
/** Visible text only: drop the sr-only copies, then the tags (per-character spans join back into "$10"). */
const visible = (html: string) => html.replace(/<span class="sr-only">[^<]*<\/span>/g, "").replace(/<[^>]+>/g, "");
/** The monthly or yearly swap layer of one plan card. */
const layer = (html: string, plan: string, which: "monthly" | "yearly") => {
  const card = html.slice(html.indexOf(`data-plan="${plan}"`));
  const start = card.indexOf(`data-layer="${which}"`);
  const end = which === "monthly" ? card.indexOf('data-layer="yearly"') : card.indexOf("<a ", start);
  return card.slice(start, end);
};

describe("pricing render: $1 first-month treatment", () => {
  it("Pro card shows a struck $15 and a crisp blue $1 with 'first month' and the after-price", () => {
    const html = render("en");
    const pro = html.slice(html.indexOf('data-plan="pro"'), html.indexOf('data-plan="business"'));
    expect(visible(pro.match(/<s [^>]*data-was[^>]*>.*?<\/s>/)![0])).toBe("$15");
    expect(visible(pro.match(/data-now[^>]*class="promo-num[^"]*">(.*?)<\/span><\/span>/)?.[1] ?? "")).toBe("$1");
    expect(pro).toContain("first month");
    expect(pro).toContain("$15/month after");
    expect(pro).toContain("Was $15, now $1 for your first month");
    expect(pro).not.toContain("Most popular");
    const biz = html.slice(html.indexOf('data-plan="business"'), html.indexOf('data-plan="max"'));
    expect(biz).toContain("Most popular");
  });

  it("only Pro gets the promo; Free stays $0, Business $50, Max $100", () => {
    const html = render("en");
    expect(html.match(/data-promo-price/g)?.length).toBe(1);
    const free = html.slice(html.indexOf('data-plan="free"'), html.indexOf('data-plan="pro"'));
    expect(free).toContain("$0");
    expect(html.slice(html.indexOf('data-plan="business"'), html.indexOf('data-plan="max"'))).toContain("$50");
    expect(html.slice(html.indexOf('data-plan="max"'))).toContain("$100");
  });

  it("every locale renders the promo with ASCII $ and Latin digits, amounts isolated LTR", () => {
    for (const l of LOCALES) {
      const html = render(l);
      const promo = html.slice(html.indexOf("data-promo-price"));
      expect(visible(promo.match(/data-was[^>]*>(.*?)<\/s>/)?.[1] ?? "")).toBe("$15");
      expect(visible(promo.match(/data-now[^>]*>(.*?)<\/span><\/span>/)?.[1] ?? "")).toBe("$1");
      expect(html).not.toMatch(/[٠-٩]/);
      expect(html).not.toMatch(/>1\$|>15\$/);
      for (const k of ["firstMonthOnly", "after", "wasNow"]) expect(msgs(l).pricing[k]).toBeTruthy();
      for (const k of ["heroTitle1", "heroTitle2", "heroLead", "hookLabel", "mockStore", "mockOrder", "mockAria"]) expect(msgs(l).landing[k]).toBeTruthy();
    }
  });

  it("PromoPrice marks both amounts dir=ltr and hides them from AT behind one sr-only sentence", () => {
    const html = renderToStaticMarkup(createElement(PromoPrice, { srLabel: "Was $15, now $1" }));
    expect(html.match(/dir="ltr"/g)?.length).toBe(2);
    expect(html).toContain('class="sr-only">Was $15, now $1<');
    expect(html.match(/aria-hidden="true"/g)?.length).toBe(2);
  });
});

describe("pricing v2: four cards, cumulative features, Soon tags", () => {
  it("renders Free, Pro, Business, Max in order; Max is the ink premium card with the animated gold accent (Max only)", () => {
    for (const l of LOCALES) {
      const html = render(l);
      const order = ["free", "pro", "business", "max"].map((p) => html.indexOf(`data-plan="${p}"`));
      expect(order.every((v, i) => v > -1 && (i === 0 || v > order[i - 1]!))).toBe(true);
      const max = html.slice(html.indexOf('data-plan="max"'));
      for (const c of ["max-card", "max-ring", "max-fill", "max-glow", "max-badge", "max-gold-text", "max-cta", "max-check"]) expect(max).toContain(c);
      expect(max).toContain("data-premium");
      // Gold is a Max-only exception: the other three cards stay blue + ink.
      const rest = html.slice(0, html.indexOf('data-plan="max"'));
      expect(rest).not.toMatch(/max-|orange|amber|yellow|gold/i);
      expect(rest).toContain("#2563EB");
      expect(html).not.toMatch(/[٠-٩]/);
    }
  });
  it("feature counts come from config and the hidden caps never render", () => {
    const html = visible(render("en"));
    expect(html).toContain("Up to 10 products");
    expect(html).toContain("Up to 100 products");
    expect(html).toContain("10 Product Studio AI edits/month");
    expect(html).toContain("100 Product Studio AI edits/month");
    expect(html).toContain("Unlimited products");
    expect(html).toContain("Everything in Free, plus:");
    expect(html).toContain("Everything in Pro, plus:");
    expect(html).toContain("Everything in Business, plus:");
    expect(html).not.toMatch(/(?<!\$)\b10?,?000\b/);
  });
  it("unbuilt features carry a Soon tag, built ones do not", () => {
    const html = render("en");
    const item = (plan: string, key: string) => {
      const card = html.slice(html.indexOf(`data-plan="${plan}"`));
      const i = card.indexOf(`data-feature="${key}"`);
      return card.slice(i, card.indexOf("</li>", i));
    };
    expect(item("max", "priorityStudio")).toContain("data-soon");
    expect(item("max", "priorityStudio")).toContain(">Soon<");
    expect(item("pro", "studio")).not.toContain("data-soon");
    expect(item("max", "aiDesigner")).not.toContain("data-soon");
    expect(item("max", "designRefresh")).toContain(">Soon<");
    expect(item("pro", "discounts")).not.toContain("data-soon");
    expect(item("free", "codWhatsapp")).not.toContain("Soon");
  });
});

describe("pricing toggle: blur swap between monthly and yearly", () => {
  it("renders both states, monthly active by default, yearly hidden from AT", () => {
    const html = render("en");
    expect(html).toContain('data-yearly="false"');
    for (const plan of ["pro", "business", "max"]) {
      expect(layer(html, plan, "monthly")).toContain('data-on="true"');
      expect(layer(html, plan, "yearly")).toMatch(/data-on="false" aria-hidden="true"/);
    }
    expect(visible(layer(html, "pro", "yearly"))).toContain("$150/year");
    expect(visible(layer(html, "business", "monthly"))).toContain("$50/month");
    expect(visible(layer(html, "business", "yearly"))).toContain("$500/year");
    expect(visible(layer(html, "max", "monthly"))).toContain("$100/month");
    expect(visible(layer(html, "max", "yearly"))).toContain("$1000/year");
    expect(visible(layer(html, "business", "yearly"))).toContain("2 months free");
  });

  it("starts on yearly when asked: yearly layers active, toggle pressed, promo layer hidden", () => {
    const html = render("en", { defaultYearly: true });
    expect(html).toContain('data-yearly="true"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Yearly/);
    expect(layer(html, "pro", "yearly")).toContain('data-on="true"');
    expect(layer(html, "pro", "monthly")).toMatch(/data-on="false" aria-hidden="true"/);
    expect(layer(html, "pro", "monthly")).toContain("data-promo-price");
  });

  it("splits prices per character with a stagger index and carries the reduced-motion class", () => {
    const html = render("en");
    const biz = layer(html, "business", "yearly");
    expect(biz.match(/class="sw[^"]*\bsw-ch\b[^"]*" style="--i:\d+"/g)?.length).toBe(4);
    expect(biz).toMatch(/class="sw motion-reduce:transition-none sw-ch"/);
    expect(html).toMatch(/class="plans-thumb[^"]*motion-reduce:transition-none/);
    expect(html).toMatch(/class="swap" style="--card:1"/);
    expect(html).toContain('<span class="sr-only">$500</span>');
  });

  it("free stays a single static $0 (nothing to swap)", () => {
    const html = render("en");
    const free = html.slice(html.indexOf('data-plan="free"'), html.indexOf('data-plan="pro"'));
    expect(free).not.toContain("data-swap");
    expect(free).toContain(">$0<");
  });
});

describe("home hero: $1 offer is the eyebrow, the glow is crisp", () => {
  const page = readFileSync("src/app/(marketing)/page.tsx", "utf8");
  const css = readFileSync("src/app/globals.css", "utf8");
  it("the $1 Pro pill replaces the old badge above the H1 and links to /pricing; the CTA row keeps two CTAs", () => {
    const eyebrow = page.indexOf("data-hero-promo");
    expect(eyebrow).toBeGreaterThan(-1);
    expect(eyebrow).toBeLessThan(page.indexOf("<h1"));
    expect(page.slice(page.lastIndexOf("<Link", eyebrow), eyebrow)).toContain('href="/pricing"');
    expect(page).not.toContain('tp("badge")');
    expect(page).not.toContain("promo-chip");
    expect(page.match(/\$1</g)?.length).toBe(1);
  });
  it("the pill is minimal: $1, the hairline, a short label and the arrow; no first-month or after-price terms", () => {
    const pill = page.slice(page.indexOf("data-hero-promo"), page.indexOf("</Link>", page.indexOf("data-hero-promo")));
    expect(pill).toContain('t("hookLabel")');
    expect(pill).not.toContain("hookThen");
    expect(pill).toContain("w-px");
    expect(pill).toContain("<ArrowForward");
    expect(pill).toContain("min-h-11");
    expect(pill).toContain('dir="ltr"');
    expect(msgs("en").landing.hookLabel).toBe("Try Pro");
    for (const l of LOCALES) {
      const label: string = msgs(l).landing.hookLabel;
      expect(msgs(l).landing.hookThen).toBeUndefined();
      expect(label).toContain("Pro");
      expect(label.length).toBeLessThanOrEqual(18);
      expect(label).not.toMatch(/\$|\d|[٠-٩۰-۹]/);
    }
  });
  it("the hero has no 'No card needed · Free forever' micro-line (removed for a calmer hero), and the key is gone in every locale", () => {
    expect(page).not.toContain("heroNote");
    expect(page).not.toContain("data-hero-note");
    for (const l of LOCALES) expect(msgs(l).landing.heroNote).toBeUndefined();
  });
  it("no blurred halo: no text-shadow or radial bloom on the promo price", () => {
    expect(css).not.toContain("glow-price");
    const block = css.slice(css.indexOf(".promo-num {"), css.indexOf("@media (forced-colors"));
    expect(block).not.toMatch(/text-shadow|radial-gradient|::before/);
  });
});
