import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db";
import { createCategory, createProduct, listProductsForExport } from "@/server/services/catalog";
import { productsToCsv, PRODUCT_CSV_HEADERS } from "@/lib/products-csv";
import { product, seller, testDb } from "./support/db";
import en from "../messages/en.json";
import ku from "../messages/ku.json";
import ar from "../messages/ar.json";
import kmr from "../messages/kmr.json";

let database: Db;
beforeAll(async () => {
  database = await testDb();
});

describe("products CSV export", () => {
  it("exports only the store's own products (active and hidden), with BOM, Kurdish text and a short link", async () => {
    const a = await seller(database, "pexa");
    const b = await seller(database, "pexb");
    await product(database, a.store.id, 25_000, 5);
    await createProduct(database, a.store.id, {
      name: { ku: "=کاڵای شاراوە", en: "Hidden, \"quoted\"" },
      description: { en: "line one\nline two" },
      price: 10_000,
      compareAtPrice: 12_000,
      stock: null,
      categoryId: null,
      isActive: false,
      imageUrls: [],
    });
    await product(database, b.store.id, 99_000);
    const rows = await listProductsForExport(database, a.store.id);
    expect(rows).toHaveLength(2);
    const csv = productsToCsv(rows, "https://bazarga.vercel.app/");
    expect(csv.startsWith("\uFEFF" + PRODUCT_CSV_HEADERS.join(","))).toBe(true);
    expect(csv).toContain("25000");
    expect(csv).not.toContain("99000");
    expect(csv).toContain("'=کاڵای شاراوە");
    expect(csv).toContain('"Hidden, ""quoted"""');
    expect(csv).toContain("line one line two");
    expect(csv).toContain("hidden");
    expect(csv).toContain("active");
    expect(csv).toMatch(/https:\/\/bazarga\.vercel\.app\/p\/[0-9a-f]{8}/);
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(3);
  });

  it("resolves the category name", async () => {
    const s = await seller(database, "pexc");
    const cat = await createCategory(database, s.store.id, { name: { ku: "جلوبەرگ", en: "Clothes" }, sort: 0 });
    await createProduct(database, s.store.id, {
      name: { en: "Shirt" }, description: {}, price: 5000, compareAtPrice: null, stock: 3, categoryId: cat.id, isActive: true, imageUrls: [],
    });
    const rows = await listProductsForExport(database, s.store.id);
    expect(rows[0]!.categoryName).toBe("جلوبەرگ");
  });

  it("has a button label in all four locales", () => {
    for (const m of [en, ku, ar, kmr]) expect((m as { products: { export?: string } }).products.export).toBeTruthy();
  });
});
