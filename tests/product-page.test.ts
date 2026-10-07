import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  absoluteUrl,
  descriptionParagraphs,
  percentOff,
  productJsonLd,
  relatedProducts,
  serializeJsonLd,
  specRows,
  stockStatus,
} from "@/lib/product-page";
import { MAX_SPECS, productSchema, productSpecsSchema, skuSchema, specsFromForm, storeStorefrontSchema } from "@/lib/validation";
import type { Db } from "@/server/db";
import { createProduct, getProduct, updateProduct } from "@/server/services/catalog";
import { loadProductDetail, loadStorefrontStore } from "@/server/services/storefront";
import { updateStoreStorefront } from "@/server/services/stores";
import { seller, testDb } from "./support/db";

describe("product page helpers", () => {
  it("percentOff only for a real discount", () => {
    expect(percentOff(25_000, 30_000)).toBe(17);
    expect(percentOff(30_000, 30_000)).toBeNull();
    expect(percentOff(30_000, null)).toBeNull();
    expect(percentOff(30_000, 25_000)).toBeNull();
    expect(percentOff(29_900, 30_000)).toBeNull(); // <1% rounds to nothing worth a badge
  });

  it("stockStatus: in stock / only N left / sold out / untracked", () => {
    expect(stockStatus(40)).toEqual({ kind: "in" });
    expect(stockStatus(3)).toEqual({ kind: "low", count: 3 });
    expect(stockStatus(0)).toEqual({ kind: "out" });
    expect(stockStatus(null)).toEqual({ kind: "untracked" });
    expect(stockStatus(null, true)).toEqual({ kind: "out" });
  });

  it("relatedProducts puts the same category first, skips self and sold out, caps at 8", () => {
    const mk = (id: string, categoryId: string | null, soldOut = false) => ({ id, categoryId, soldOut });
    const cat = [mk("a", "x"), mk("b", "y"), mk("c", "x"), mk("d", "x", true), mk("self", "x"), ...Array.from({ length: 10 }, (_, i) => mk(`z${i}`, "y"))];
    const r = relatedProducts(cat, { id: "self", categoryId: "x" });
    expect(r.map((p) => p.id).slice(0, 3)).toEqual(["a", "c", "b"]);
    expect(r).toHaveLength(8);
    expect(r.find((p) => p.id === "self" || p.id === "d")).toBeUndefined();
    expect(relatedProducts(cat, { id: "self", categoryId: null }, 2).map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("descriptionParagraphs splits on blank lines and keeps single line breaks", () => {
    expect(descriptionParagraphs("One\nline two\r\n\r\n\n  Para <b>2</b>  \n")).toEqual([["One", "line two"], ["Para <b>2</b>"]]);
    expect(descriptionParagraphs("   ")).toEqual([]);
  });

  it("specRows picks the shopper's language with fallback and drops blank rows", () => {
    const specs = [
      { label: { ku: "کەرەستە", en: "Material" }, value: { ku: "لۆکە", en: "Cotton" } },
      { label: { en: "Origin" }, value: { en: "Erbil" } },
      { label: { en: "Empty" }, value: {} },
    ];
    expect(specRows(specs, "ku")).toEqual([
      { label: "کەرەستە", value: "لۆکە" },
      { label: "Origin", value: "Erbil" },
    ]);
    expect(specRows(null, "en")).toEqual([]);
  });

  it("builds Product JSON-LD with an IQD Offer and availability", () => {
    const ld = productJsonLd({
      url: "https://x.app/s/a/p/1",
      name: "Honey",
      description: "Mountain honey",
      images: ["https://x.app/i.webp"],
      sku: "HB-1",
      storeName: "Hawler Bazaar",
      price: 25_000,
      soldOut: false,
    });
    expect(ld["@type"]).toBe("Product");
    expect(ld.sku).toBe("HB-1");
    expect(ld.offers).toMatchObject({ "@type": "Offer", priceCurrency: "IQD", price: 25_000, availability: "https://schema.org/InStock" });
    const agg = productJsonLd({ url: "u", name: "Dress", description: "", images: [], sku: null, storeName: "S", price: 10, priceMax: 20, soldOut: true });
    expect(agg.offers).toMatchObject({ "@type": "AggregateOffer", lowPrice: 10, highPrice: 20, availability: "https://schema.org/OutOfStock" });
    expect(agg).not.toHaveProperty("image");
  });

  it("serializeJsonLd cannot be broken out of with seller text", () => {
    const s = serializeJsonLd({ name: "</script><script>alert(1)</script>&" });
    expect(s).not.toContain("<");
    expect(s).not.toContain(">");
    expect(JSON.parse(s).name).toBe("</script><script>alert(1)</script>&");
  });

  it("absoluteUrl", () => {
    expect(absoluteUrl("https://a.app/", "/images/x.webp")).toBe("https://a.app/images/x.webp");
    expect(absoluteUrl("https://a.app", "https://cdn/x.webp")).toBe("https://cdn/x.webp");
  });
});

describe("specs validation", () => {
  it("accepts rows, drops fully blank ones, trims", () => {
    const r = productSpecsSchema.parse([
      { label: { en: " Material " }, value: { en: "Cotton", ku: "لۆکە" } },
      { label: { en: "" }, value: {} },
    ]);
    expect(r).toEqual([{ label: { en: "Material" }, value: { en: "Cotton", ku: "لۆکە" } }]);
  });

  it("rejects a row with a label but no value (and vice versa)", () => {
    expect(productSpecsSchema.safeParse([{ label: { en: "Weight" }, value: {} }]).success).toBe(false);
    expect(productSpecsSchema.safeParse([{ label: {}, value: { en: "1 kg" } }]).success).toBe(false);
  });

  it("caps rows and cell length", () => {
    const row = { label: { en: "A" }, value: { en: "B" } };
    expect(productSpecsSchema.safeParse(Array.from({ length: MAX_SPECS }, () => row)).success).toBe(true);
    expect(productSpecsSchema.safeParse(Array.from({ length: MAX_SPECS + 1 }, () => row)).success).toBe(false);
    expect(productSpecsSchema.safeParse([{ label: { en: "x".repeat(121) }, value: { en: "B" } }]).success).toBe(false);
  });

  it("productSchema defaults specs to [] and validates sku", () => {
    const p = productSchema.parse({ name: { en: "X" }, price: 1000 });
    expect(p.specs).toEqual([]);
    expect(skuSchema.parse(" HB-1 ")).toBe("HB-1");
    expect(skuSchema.parse("")).toBeNull();
    expect(skuSchema.safeParse("bad sku!").success).toBe(false);
  });

  it("specsFromForm reads indexed fields in order, tolerating gaps", () => {
    const fd = new FormData();
    fd.append("specs.3.label.en", "Origin");
    fd.append("specs.3.value.en", "Erbil");
    fd.append("specs.0.label.ku", "کێش");
    fd.append("specs.0.value.ku", "١ کگ");
    fd.append("specs.0.label.zz", "ignored");
    fd.append("name.en", "not a spec");
    expect(specsFromForm(fd)).toEqual([
      { label: { ku: "کێش" }, value: { ku: "١ کگ" } },
      { label: { en: "Origin" }, value: { en: "Erbil" } },
    ]);
  });

  it("storefront schema keeps valid cover renditions and drops junk", () => {
    const ok = storeStorefrontSchema.parse({
      coverImageUrl: "/images/seed/cover-1600.webp",
      coverImagePlaceholder: null,
      coverImageRenditions: [{ width: 640, height: 360, url: "/images/seed/cover-640.webp", key: "k", bytes: 10 }],
      freeDeliveryThreshold: null,
    });
    expect(ok.coverImageRenditions).toHaveLength(1);
    const junk = storeStorefrontSchema.parse({ coverImageUrl: null, coverImagePlaceholder: null, coverImageRenditions: [{ url: "javascript:x" }], freeDeliveryThreshold: null });
    expect(junk.coverImageRenditions).toEqual([]);
  });
});

describe("specs + sku persistence", () => {
  let database: Db;
  beforeAll(async () => {
    database = await testDb();
  });

  it("round-trips through create/update and the storefront detail loader", async () => {
    const { store } = await seller(database, "spec");
    const specs = productSpecsSchema.parse([
      { label: { en: "Material", ku: "کەرەستە" }, value: { en: "Cotton", ku: "لۆکە" } },
      { label: { en: "Origin" }, value: { en: "Erbil" } },
    ]);
    const p = await createProduct(database, store.id, {
      name: { en: "Shirt" },
      description: {},
      price: 30_000,
      stock: 4,
      sku: "HB-SHIRT",
      specs,
      isActive: true,
      imageUrls: [],
    });
    let d = await loadProductDetail(database, store.id, p.id);
    expect(d?.sku).toBe("HB-SHIRT");
    expect(d?.specs).toEqual(specs);

    await updateProduct(database, store.id, p.id, { name: { en: "Shirt" }, description: {}, price: 30_000, stock: 4, sku: null, specs: [], isActive: true, imageUrls: [] });
    d = await loadProductDetail(database, store.id, p.id);
    expect(d?.sku).toBeNull();
    expect(d?.specs).toEqual([]);
    expect((await getProduct(database, store.id, p.id))?.specs).toEqual([]);
  });

  it("products created without specs (older callers) get an empty table", async () => {
    const { store } = await seller(database, "nospec");
    const p = await createProduct(database, store.id, { name: { en: "X" }, description: {}, price: 1000, isActive: true, imageUrls: [] });
    expect((await loadProductDetail(database, store.id, p.id))?.specs).toEqual([]);
  });

  it("stores and serves cover renditions; removing the cover clears them", async () => {
    const { store } = await seller(database, "cover");
    const renditions = [{ width: 640, height: 360, url: "/images/seed/c-640.webp", key: "c-640", bytes: 1 }];
    await updateStoreStorefront(database, store.id, { coverImageUrl: "/images/seed/c-1600.webp", coverImagePlaceholder: null, coverImageRenditions: renditions, freeDeliveryThreshold: null });
    expect((await loadStorefrontStore(database, store.slug))?.coverImageRenditions).toEqual(renditions);
    await updateStoreStorefront(database, store.id, { coverImageUrl: null, coverImagePlaceholder: null, coverImageRenditions: renditions, freeDeliveryThreshold: null });
    expect((await loadStorefrontStore(database, store.slug))?.coverImageRenditions).toEqual([]);
  });
});

describe("product page source guards", () => {
  const page = readFileSync("src/app/s/[slug]/p/[productId]/page.tsx", "utf8");
  it("renders the description as text, never as HTML", () => {
    expect(page).not.toMatch(/dangerouslySetInnerHTML=\{\{ __html: description/);
    expect(page.match(/dangerouslySetInnerHTML/g)).toHaveLength(1); // only the escaped JSON-LD
    expect(page).toContain("serializeJsonLd(jsonLd)");
  });
  it("loads the fullscreen viewer lazily", () => {
    const g = readFileSync("src/components/store/ProductGallery.tsx", "utf8");
    expect(g).toMatch(/lazy\(loadLightbox\)/);
    expect(g).not.toMatch(/^import .*GalleryLightbox/m);
  });
});
