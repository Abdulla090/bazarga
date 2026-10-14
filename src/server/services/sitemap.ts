import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db";
import { products, stores } from "../db/schema";

export const SITEMAP_MAX_STORES = 2000;
export const SITEMAP_MAX_PRODUCTS = 20000;

/** Public storefront URLs for the sitemap: active stores and their active products only (nothing private). */
export async function loadSitemapEntries(database: Db) {
  const storeRows = await database
    .select({ id: stores.id, slug: stores.slug, updatedAt: stores.updatedAt })
    .from(stores)
    .where(eq(stores.isActive, true))
    .orderBy(desc(stores.updatedAt))
    .limit(SITEMAP_MAX_STORES);
  const productRows = await database
    .select({ id: products.id, slug: stores.slug, updatedAt: products.updatedAt })
    .from(products)
    .innerJoin(stores, eq(products.storeId, stores.id))
    .where(and(eq(products.isActive, true), eq(stores.isActive, true)))
    .orderBy(desc(products.updatedAt))
    .limit(SITEMAP_MAX_PRODUCTS);
  return { stores: storeRows, products: productRows };
}
