import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { products, stores } from "@/server/db/schema";
import { compactSeo, effectiveSeo, productSeoSchema, storeJsonLd, storeSeoSchema, storeSitemapXml, whiteLabelOn } from "@/lib/seo";
import { getPlan, showsBazargaBadge } from "@/lib/plans";
import { updateProductSeo, updateStoreSeo } from "@/server/services/seo";
import { loadProductDetail, loadStorefrontStore } from "@/server/services/storefront";
import { product, seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => { database = await testDb(); });

describe("advanced SEO helpers", () => {
  it("validates and trims overrides; empty fields drop out", () => {
    const s = storeSeoSchema.parse({ title: "  Studio   Hawler ", description: "", ogImageUrl: "https://cdn.example.com/og.png" });
    expect(compactSeo(s)).toEqual({ title: "Studio Hawler", ogImageUrl: "https://cdn.example.com/og.png" });
    expect(() => storeSeoSchema.parse({ ogImageUrl: "http://insecure.example.com/x.png" })).toThrow();
    expect(() => storeSeoSchema.parse({ ogImageUrl: "javascript:alert(1)" })).toThrow();
    expect(() => productSeoSchema.parse({ title: "x".repeat(71) })).toThrow();
    expect(() => productSeoSchema.parse({ description: "x".repeat(161) })).toThrow();
  });

  it("overrides apply only on Max", () => {
    const seo = { title: "T" };
    expect(effectiveSeo("business", seo)).toEqual({});
    expect(effectiveSeo("max", seo)).toEqual(seo);
  });

  it("white-label needs Max and the switch; the badge stays Free-only otherwise", () => {
    expect(whiteLabelOn("business", true)).toBe(false);
    expect(whiteLabelOn("max", false)).toBe(false);
    expect(whiteLabelOn("max", true)).toBe(true);
    expect(showsBazargaBadge("free")).toBe(true);
    expect(showsBazargaBadge("free", true)).toBe(true); // Free can't buy its way out with a stale flag
    expect(showsBazargaBadge("pro")).toBe(false);
    expect(showsBazargaBadge("max", true)).toBe(false);
  });

  it("Store JSON-LD and the per-store sitemap", () => {
    const ld = storeJsonLd({ name: "S", url: "https://x/s/s", telephone: "9647501234567", city: "erbil", sameAs: ["https://instagram.com/s"] });
    expect(ld).toMatchObject({ "@type": "Store", telephone: "+9647501234567", address: { addressLocality: "erbil", addressCountry: "IQ" } });
    const xml = storeSitemapXml("https://x/", "shop", new Date(0), [{ id: "p1", updatedAt: new Date(0) }]);
    expect(xml).toContain("<loc>https://x/s/shop</loc>");
    expect(xml).toContain("<loc>https://x/s/shop/p/p1</loc>");
  });

  it("pricing no longer marks SEO / white-label as soon", () => {
    for (const k of ["seoAdvanced", "whiteLabel"]) expect(getPlan("max").features.find((f) => f.key === k)?.soon).toBeFalsy();
  });
});

describe("advanced SEO storage (server)", () => {
  it("saves store + product overrides, tenant-scoped", async () => {
    const a = await seller(database, "seo-a");
    const b = await seller(database, "seo-b");
    await database.update(stores).set({ plan: "max" }).where(eq(stores.id, a.store.id));
    await updateStoreSeo(database, a.store.id, { title: "Hawler linen", description: "Shirts" }, true);
    const sf = await loadStorefrontStore(database, a.store.slug);
    expect(sf).toMatchObject({ seo: { title: "Hawler linen", description: "Shirts" }, whiteLabel: true });
    const p = await product(database, a.store.id, 1000);
    await updateProductSeo(database, a.store.id, p.id, { title: "Linen shirt Erbil" });
    expect((await loadProductDetail(database, a.store.id, p.id))?.seo).toEqual({ title: "Linen shirt Erbil" });
    await expect(updateProductSeo(database, b.store.id, p.id, { title: "hijack" })).rejects.toThrow();
    const [row] = await database.select({ seo: products.seo }).from(products).where(eq(products.id, p.id));
    expect(row?.seo).toEqual({ title: "Linen shirt Erbil" });
  });

  it("the SEO server actions enforce the Max gate", () => {
    const src = readFileSync("src/server/actions/seo.ts", "utf8");
    expect(src.match(/assertFeature\(store, "seoAdvanced"\)/g)?.length).toBe(2);
    const sm = readFileSync("src/app/s/[slug]/sitemap.xml/route.ts", "utf8");
    expect(sm).toContain('hasFeature(normalizePlan(st.plan), "seoAdvanced")');
  });
});
