import { readFileSync } from "node:fs";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { PricingPlans } from "@/components/pricing/PricingPlans";
import { PromoPrice } from "@/components/pricing/PromoPrice";

const LOCALES = ["en", "ku", "kmr", "ar"] as const;
const msgs = (l: string) => JSON.parse(readFileSync(`messages/${l}.json`, "utf8"));
const render = (l: string) =>
  renderToStaticMarkup(createElement(
    NextIntlClientProvider,
    { locale: l, messages: msgs(l), timeZone: "Asia/Baghdad" } as ComponentProps<typeof NextIntlClientProvider>,
    createElement(PricingPlans),
  ));

describe("pricing render: $1 first-month treatment", () => {
  it("Pro card shows a struck $10 and a glowing $1 with 'first month' and the after-price", () => {
    const html = render("en");
    const pro = html.slice(html.indexOf('data-plan="pro"'), html.indexOf('data-plan="business"'));
    expect(pro).toMatch(/<s [^>]*data-was[^>]*>\$10<\/s>/);
    expect(pro).toMatch(/class="glow-price[^"]*"[^>]*>\$1<\/span>|data-now[^>]*class="glow-price[^"]*">\$1</);
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
      expect(html).toContain(">$1<");
      expect(html).toContain(">$10<");
      expect(html).not.toMatch(/[٠-٩]/);
      expect(html).not.toMatch(/1\$|10\$/);
      for (const k of ["firstMonthOnly", "after", "wasNow"]) expect(msgs(l).pricing[k]).toBeTruthy();
      for (const k of ["heroTitle1", "heroTitle2", "heroLead", "heroNote", "hookLabel", "hookThen", "mockStore", "mockOrder", "mockAria"]) expect(msgs(l).landing[k]).toBeTruthy();
    }
  });

  it("PromoPrice marks both amounts dir=ltr and hides them from AT behind one sr-only sentence", () => {
    const html = renderToStaticMarkup(createElement(PromoPrice, { srLabel: "Was $10, now $1" }));
    expect(html.match(/dir="ltr"/g)?.length).toBe(2);
    expect(html).toContain('class="sr-only">Was $10, now $1<');
    expect(html.match(/aria-hidden="true"/g)?.length).toBe(2);
  });
});
