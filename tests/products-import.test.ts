import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db";
import { createProduct, listProductsForExport } from "@/server/services/catalog";
import { productsToCsv } from "@/lib/products-csv";
import { IMPORT_MAX_ROWS, importTemplateCsv, parseCsv, parseProductsCsv } from "@/lib/products-csv-import";
import { seller, testDb } from "./support/db";
import en from "../messages/en.json";
import ku from "../messages/ku.json";
import ar from "../messages/ar.json";
import kmr from "../messages/kmr.json";

let database: Db;
beforeAll(async () => {
  database = await testDb();
});

describe("parseCsv", () => {
  it("handles BOM, quotes, doubled quotes, embedded newlines, CRLF and ; or tab delimiters", () => {
    expect(parseCsv('\uFEFFa,b\r\n"x, y","he said ""hi"""\r\n"l1\nl2",z\r\n')).toEqual([["a", "b"], ["x, y", 'he said "hi"'], ["l1\nl2", "z"]]);
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("parseProductsCsv", () => {
  it("accepts spreadsheet numbers, Arabic digits, hidden status and ignores unknown columns", () => {
    const r = parseProductsCsv("name_ku,name_en,price,compare_at_price,stock,status,whatever\nکراسی,Shirt,\"25,000\",30000,١٠,hidden,x\n");
    expect(r.fatal).toBeUndefined();
    const i = r.rows[0]!.input!;
    expect(i.name).toEqual({ ku: "کراسی", en: "Shirt" });
    expect(i.price).toBe(25000);
    expect(i.compareAtPrice).toBe(30000);
    expect(i.stock).toBe(10);
    expect(i.isActive).toBe(false);
  });
  it("reports bad rows by line without failing the good ones", () => {
    const r = parseProductsCsv("name_en,price,compare_at_price\nOk,1000,\n,500,\nNoPrice,abc,\nCheap,1000,900\n");
    expect(r.rows.map((x) => !!x.input)).toEqual([true, false, false, false]);
    expect(r.rows[1]!.line).toBe(3);
    expect(r.rows[3]!.error).toBe("compare_at_price");
    expect(r.rows[2]!.error).toBe("price");
  });
  it("fails fast on a missing name/price column, empty or oversized input", () => {
    expect(parseProductsCsv("name_en,price").fatal).toBe("empty");
    expect(parseProductsCsv("price,sku\n1,a").fatal).toBe("no_name_column");
    expect(parseProductsCsv("name_en,sku\nA,a").fatal).toBe("no_price_column");
    expect(parseProductsCsv("").fatal).toBe("empty");
    const many = "name_en,price\n" + Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, n) => `P${n},1`).join("\n");
    expect(parseProductsCsv(many).fatal).toBe("too_many_rows");
  });
  it("round-trips our own export (formula-safe apostrophe is undone)", async () => {
    const a = await seller(database, "pimp");
    await createProduct(database, a.store.id, { name: { ku: "=کاڵا", en: "Mug, \"big\"" }, description: { en: "nice" }, price: 12000, stock: 3, categoryId: null, isActive: true, imageUrls: [] });
    const csv = productsToCsv(await listProductsForExport(database, a.store.id), "https://x.app");
    const r = parseProductsCsv(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.input!.name).toEqual({ ku: "=کاڵا", en: 'Mug, "big"' });
    expect(r.rows[0]!.input!.stock).toBe(3);
  });
  it("the starter template parses clean", () => {
    const r = parseProductsCsv(importTemplateCsv());
    expect(r.rows.every((x) => x.input)).toBe(true);
  });
});

describe("import copy is in all 4 locales", () => {
  it("has the same products.import* keys everywhere", () => {
    const keys = Object.keys(en.products).filter((k) => k.startsWith("import"));
    expect(keys.length).toBeGreaterThan(14);
    for (const m of [ku, ar, kmr]) for (const k of keys) expect((m.products as Record<string, unknown>)[k], k).toBeTruthy();
  });
});
