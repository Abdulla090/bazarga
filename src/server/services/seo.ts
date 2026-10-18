import { and, eq } from "drizzle-orm";
import type { Db } from "../db";
import { products, stores } from "../db/schema";
import { AppError } from "../errors";
import { compactSeo, type ProductSeo, type StoreSeo } from "@/lib/seo";

export async function updateStoreSeo(database: Db, storeId: string, seo: StoreSeo, whiteLabel: boolean): Promise<void> {
  const r = await database.update(stores).set({ seo: compactSeo(seo), whiteLabel, updatedAt: new Date() }).where(eq(stores.id, storeId)).returning({ id: stores.id });
  if (!r.length) throw new AppError("NOT_FOUND");
}

/** Tenant-scoped: a product id from another store is NOT_FOUND. */
export async function updateProductSeo(database: Db, storeId: string, productId: string, seo: ProductSeo): Promise<void> {
  const r = await database
    .update(products)
    .set({ seo: compactSeo(seo), updatedAt: new Date() })
    .where(and(eq(products.id, productId), eq(products.storeId, storeId)))
    .returning({ id: products.id });
  if (!r.length) throw new AppError("NOT_FOUND");
}
