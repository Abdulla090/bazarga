import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "../db";
import {
  loadCatalog,
  loadProductDetail,
  loadStorefrontSettings,
  loadStorefrontStore,
  type Catalog,
  type ProductDetail,
  type StorefrontSettings,
  type StorefrontStore,
} from "../services/storefront";
import { cacheTags } from "./tags";

/**
 * Cached storefront data layer (Next 16 `"use cache"`, cacheComponents on).
 *
 * The root layout calls connection() for the nonce CSP, so storefront *pages* render per request; what is
 * cached is the data they read. A warm storefront view runs zero SQL: store, settings, catalog and product
 * detail are each one in-memory entry keyed by its arguments and tagged per store / product (./tags.ts).
 * Seller writes invalidate by tag; the "storefront" cacheLife profile (next.config.ts) is only a safety net for
 * writes that bypass the app (manual SQL).
 *
 * Multi-instance deployments need a shared cache handler (next.config cacheHandlers) so an invalidation on
 * one instance reaches the others; a single standalone container (our Docker target) is covered as is.
 */

export async function getStorefrontStore(slug: string): Promise<StorefrontStore | null> {
  "use cache";
  cacheLife("storefront");
  cacheTag(cacheTags.storeSlug(slug));
  const store = await loadStorefrontStore(db(), slug);
  if (store) cacheTag(cacheTags.store(store.id));
  return store;
}

export async function getStorefrontSettings(storeId: string): Promise<StorefrontSettings> {
  "use cache";
  cacheLife("storefront");
  cacheTag(cacheTags.store(storeId));
  return loadStorefrontSettings(db(), storeId);
}

export async function getCatalog(storeId: string): Promise<Catalog> {
  "use cache";
  cacheLife("storefront");
  cacheTag(cacheTags.catalog(storeId));
  return loadCatalog(db(), storeId);
}

export async function getProductDetail(storeId: string, productId: string): Promise<ProductDetail | null> {
  "use cache";
  cacheLife("storefront");
  cacheTag(cacheTags.catalog(storeId), cacheTags.product(productId));
  return loadProductDetail(db(), storeId, productId);
}
