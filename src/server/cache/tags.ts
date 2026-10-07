import "server-only";
import { revalidateTag } from "next/cache";

/**
 * Storefront cache tags. Every cached read in src/server/cache/storefront.ts carries one or more of these;
 * every seller write calls the matching invalidate* helper so the next storefront view reads fresh data.
 *
 *   store:<storeId>      store row (name, theme, cover, policies, threshold) + delivery zones/areas + payment methods
 *   store-slug:<slug>    slug → store lookup (also tagged store:<id> once resolved; a 404 is tagged by slug only)
 *   catalog:<storeId>    product grid + categories, and every product page of the store
 *   product:<productId>  one product page (images, options, variants, stock)
 */
export const cacheTags = {
  store: (storeId: string) => `store:${storeId}`,
  storeSlug: (slug: string) => `store-slug:${slug}`,
  catalog: (storeId: string) => `catalog:${storeId}`,
  product: (productId: string) => `product:${productId}`,
} as const;

/**
 * Expire immediately (`expire: 0`): the seller who just pressed Save, and the shopper right after a stock
 * decrement, must never be served the stale entry while it revalidates in the background.
 */
const NOW = { expire: 0 } as const;

function invalidate(tags: Iterable<string>) {
  for (const t of new Set(tags)) revalidateTag(t, NOW);
}

/** Store profile, theme, cover, policies, free-delivery threshold, delivery zones/areas, payment methods. */
export function invalidateStore(storeId: string, slugs: (string | null | undefined)[] = []) {
  invalidate([cacheTags.store(storeId), ...slugs.filter((s): s is string => !!s).map(cacheTags.storeSlug)]);
}

/** Products and categories. With product ids, also those product pages (the catalog tag already covers them all). */
export function invalidateCatalog(storeId: string, productIds: (string | null | undefined)[] = []) {
  invalidate([cacheTags.catalog(storeId), ...productIds.filter((p): p is string => !!p).map(cacheTags.product)]);
}

/**
 * Stock changed (order placed, cancelled/returned restock): the product pages show stock and the grid shows
 * "sold out" / "only N left", so both go.
 */
export function invalidateStock(storeId: string, productIds: (string | null | undefined)[]) {
  invalidateCatalog(storeId, productIds);
}
