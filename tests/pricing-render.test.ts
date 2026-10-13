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
  it("Pro card shows a struck $10 and a crisp blue $1 with 'first month' and the after-price", () => {
    const html = render("en");
    const pro = html.slice(html.indexOf('data-plan="pro"'), html.indexOf('data-plan="business"'));
    expect(visible(pro.match(/<s [^>]*data-was[^>]*>.*?<\/s>/)![0])).toBe("$10");
    expect(visible(pro.match(/data-now[^>]*class="promo-num[^"]*">(.*?)<\/span><\/span>/)?.[1] ?? "")).toBe("$1");
    expect(pro).toContain("first month");
    expect(pro).toContain("$10/month after");
    expect(pro).toContain("Was $10, now $1 for your first month");
    expect(pro).toContain("Most popular");
  });

  it("only Pro gets the promo; Free stays $0 and Business $20", () => {
    const html = render("en");
    expect(html.match(/data-promo-price/g)?.length).toBe(1);
    const free = html.slice(html.indexOf('data-plan="free"'), html.indexOf('data-plan="pro"'));
    expect(free).toContain("$0");
    expect(html.slice(html.indexOf('data-plan="business"'))).toContain("$20");
  });

  it("every locale renders the promo with ASCII $ and Latin digits, amounts isolated LTR", () => {
    for (const l of LOCALES) {
      const html = render(l);
      const promo = html.slice(html.indexOf("data-promo-price"));
      expect(visible(promo.match(/data-was[^>]*>(.*?)<\/s>/)?.[1] ?? "")).toBe("$10");
      expect(visible(promo.match(/data-now[^>]*>(.*?)<\/span><\/span>/)?.[1] ?? "")).toBe("$1");
      expect(html).not.toMatch(/[٠-٩]/);
      expect(html).not.toMatch(/>1\$|>10\$/);
      for (const k of ["firstMonthOnly", "after", "wasNow"]) expect(msgs(l).pricing[k]).toBeTruthy();
      for (const k of ["heroTitle1", "heroTitle2", "heroLead", "heroNote", "hookLabel", "mockStore", "mockOrder", "mockAria"]) expect(msgs(l).landing[k]).toBeTruthy();
    }
  });

  it("PromoPrice marks both amounts dir=ltr and hides them from AT behind one sr-only sentence", () => {
    const html = renderToStaticMarkup(createElement(PromoPrice, { srLabel: "Was $10, now $1" }));
    expect(html.match(/dir="ltr"/g)?.length).toBe(2);
    expect(html).toContain('class="sr-only">Was $10, now $1<');
    expect(html.match(/aria-hidden="true"/g)?.length).toBe(2);
  });
});

describe("pricing toggle: blur swap between monthly and yearly", () => {
  it("renders both states, monthly active by default, yearly hidden from AT", () => {
    const html = render("en");
    expect(html).toContain('data-yearly="false"');
    for (const plan of ["pro", "business"]) {
      expect(layer(html, plan, "monthly")).toContain('data-on="true"');
      expect(layer(html, plan, "yearly")).toMatch(/data-on="false" aria-hidden="true"/);
    }
    expect(visible(layer(html, "pro", "yearly"))).toContain("$100/year");
    expect(visible(layer(html, "business", "monthly"))).toContain("$20/month");
    expect(visible(layer(html, "business", "yearly"))).toContain("$200/year");
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
    expect(html).toContain('<span class="sr-only">$200</span>');
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
  it("'No card needed · Free forever' survives once, as the micro-line under the CTAs, in every locale", () => {
    expect(page.match(/t\("heroNote"\)/g)?.length).toBe(1);
    expect(msgs("en").landing.heroNote).toBe("No card needed · Free forever");
    for (const l of LOCALES) expect(msgs(l).landing.heroNote).toContain("·");
  });
  it("no blurred halo: no text-shadow or radial bloom on the promo price", () => {
    expect(css).not.toContain("glow-price");
    const block = css.slice(css.indexOf(".promo-num {"), css.indexOf("@media (forced-colors"));
    expect(block).not.toMatch(/text-shadow|radial-gradient|::before/);
  });
});
