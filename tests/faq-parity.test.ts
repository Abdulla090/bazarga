import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import ku from "../messages/ku.json";
import kmr from "../messages/kmr.json";
import ar from "../messages/ar.json";

type Faq = { title: string; items: Record<string, { q: string; a: string }> };
const faqs: Record<string, Faq> = {
  en: (en as { landingFaq: Faq }).landingFaq,
  ku: (ku as { landingFaq: Faq }).landingFaq,
  kmr: (kmr as { landingFaq: Faq }).landingFaq,
  ar: (ar as { landingFaq: Faq }).landingFaq,
};

describe("landing FAQ parity", () => {
  for (const [loc, faq] of Object.entries(faqs)) {
    it(`${loc} has every question with non-empty text`, () => {
      expect(Object.keys(faq.items).sort()).toEqual(Object.keys(faqs.en.items).sort());
      expect(faq.title.length).toBeGreaterThan(0);
      for (const it of Object.values(faq.items)) {
        expect(it.q.trim().length).toBeGreaterThan(0);
        expect(it.a.trim().length).toBeGreaterThan(0);
      }
    });
  }
});
