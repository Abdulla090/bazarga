import { describe, expect, it } from "vitest";
import { filterCatalog, normalizeSearchText, parsePage } from "@/lib/catalog-filter";

const P = (id: string, name: Record<string, string>, categoryId: string | null = null) => ({ id, name, categoryId });
const products = [
  P("1", { ku: "کراسی سپی", en: "White shirt", ar: "قميص أبيض" }, "c1"),
  P("2", { ku: "پێڵاوی ڕەش", en: "Black shoes" }, "c2"),
  P("3", { ar: "كتاب عربي", en: "Arabic book" }, "c1"),
  P("4", { ku: "چایی کوردی" }, null),
];

describe("normalizeSearchText", () => {
  it("folds Arabic/Kurdish letter variants, tatweel and diacritics", () => {
    expect(normalizeSearchText("كتاب")).toBe(normalizeSearchText("کتاب"));
    expect(normalizeSearchText("عربي")).toBe(normalizeSearchText("عربی"));
    expect(normalizeSearchText("ڕەش")).toBe(normalizeSearchText("ڕهش"));
    expect(normalizeSearchText("كـــتاب")).toBe("کتاب");
    expect(normalizeSearchText("كِتَابٌ")).toBe("کتاب");
    expect(normalizeSearchText("  WHITE   Shirt ")).toBe("white shirt");
  });
});

describe("filterCatalog", () => {
  it("returns everything without filters", () => {
    const r = filterCatalog(products, { locale: "ku" });
    expect(r.total).toBe(4);
    expect(r.hasMore).toBe(false);
  });
  it("matches any locale, case-insensitive", () => {
    expect(filterCatalog(products, { q: "WHITE", locale: "ku" }).items.map((p) => p.id)).toEqual(["1"]);
    expect(filterCatalog(products, { q: "قميص", locale: "en" }).items.map((p) => p.id)).toEqual(["1"]);
  });
  it("matches across ي/ی, ك/ک, ه/ە variants", () => {
    expect(filterCatalog(products, { q: "کتاب عربی", locale: "ku" }).items.map((p) => p.id)).toEqual(["3"]);
    expect(filterCatalog(products, { q: "رهش", locale: "ku" }).items).toHaveLength(0); // ڕ ≠ ر
    expect(filterCatalog(products, { q: "ڕهش", locale: "ku" }).items.map((p) => p.id)).toEqual(["2"]);
    expect(filterCatalog(products, { q: "چاي كوردي", locale: "ar" }).items.map((p) => p.id)).toEqual(["4"]);
  });
  it("combines category and query", () => {
    expect(filterCatalog(products, { c: "c1", locale: "en" }).items.map((p) => p.id)).toEqual(["1", "3"]);
    expect(filterCatalog(products, { c: "c1", q: "book", locale: "en" }).items.map((p) => p.id)).toEqual(["3"]);
    expect(filterCatalog(products, { c: "c2", q: "book", locale: "en" }).total).toBe(0);
  });
  it("paginates cumulatively", () => {
    const many = Array.from({ length: 60 }, (_, i) => P(String(i), { en: `item ${i}` }));
    const p1 = filterCatalog(many, { locale: "en" });
    expect(p1.items).toHaveLength(24);
    expect(p1.hasMore).toBe(true);
    const p2 = filterCatalog(many, { locale: "en", page: "2" });
    expect(p2.items).toHaveLength(48);
    expect(p2.items[0].id).toBe("0");
    const p3 = filterCatalog(many, { locale: "en", page: 3 });
    expect(p3.items).toHaveLength(60);
    expect(p3.hasMore).toBe(false);
    expect(filterCatalog(many, { locale: "en", page: 1, pageSize: 10 }).items).toHaveLength(10);
  });
  it("parsePage clamps junk", () => {
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("-3")).toBe(1);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("4")).toBe(4);
    expect(parsePage("999999")).toBe(1000);
  });
});
