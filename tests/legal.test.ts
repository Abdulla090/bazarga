import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEGAL_SLUGS, LEGAL_UPDATED, legalDoc } from "../src/content/legal";
import { LOCALES } from "../src/lib/i18n";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("legal content", () => {
  for (const slug of LEGAL_SLUGS) {
    describe(slug, () => {
      const en = legalDoc(slug, "en");
      for (const locale of LOCALES) {
        const doc = legalDoc(slug, locale);
        it(`${locale}: same section and paragraph shape as English, nothing empty`, () => {
          expect(doc.title.length).toBeGreaterThan(3);
          expect(doc.intro.length).toBeGreaterThan(20);
          expect(doc.sections.map((s) => s.p.length)).toEqual(en.sections.map((s) => s.p.length));
          for (const s of doc.sections) {
            expect(s.h.trim().length).toBeGreaterThan(2);
            for (const p of s.p) expect(p.trim().length).toBeGreaterThan(30);
          }
        });
        it(`${locale}: Latin digits only, numbered headings in order`, () => {
          const all = JSON.stringify(doc);
          expect(all).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
          doc.sections.forEach((s, i) => expect(s.h.startsWith(`${i + 1}.`)).toBe(true));
        });
        it(`${locale}: numbers match English (days and months stay the same)`, () => {
          const nums = (d: typeof doc) => d.sections.flatMap((s) => s.p).join(" ").match(/\d+/g)?.filter((n) => n !== "1") ?? []; // "1 day" is a word in Arabic
          expect(nums(doc)).toEqual(nums(en));
        });
      }
    });
  }

  it("has a date in ISO form", () => expect(LEGAL_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/));
});

describe("legal wiring", () => {
  it("routes exist for every legal slug and render through LegalPage", () => {
    for (const s of LEGAL_SLUGS) expect(read(`src/app/(marketing)/${s}/page.tsx`)).toContain(`<LegalPage slug="${s}"`);
  });
  it("footer links all three pages and signup links terms + privacy", () => {
    const f = read("src/components/SiteFooter.tsx");
    for (const s of LEGAL_SLUGS) expect(f).toContain(`"${s}"`);
    const su = read("src/app/(auth)/signup/SignupForm.tsx");
    expect(su).toContain('href="/terms"');
    expect(su).toContain('href="/privacy"');
  });
  it("legal slugs are not claimable as store slugs on the storefront", () => {
    // stores live under /s/<slug>, so top-level legal routes never collide
    expect(read("src/app/(marketing)/terms/page.tsx")).not.toContain("params");
  });
});
