import { and, eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { products, stores } from "@/server/db/schema";
import { shortCodeSchema } from "@/lib/short-link";

/** Resolve a short code to its product (active products only). null for unknown/invalid codes. */
export async function resolveShortCode(database: Db, code: string): Promise<{ slug: string; productId: string } | null> {
  const parsed = shortCodeSchema.safeParse(code.toLowerCase());
  if (!parsed.success) return null;
  const [row] = await database
    .select({ slug: stores.slug, productId: products.id })
    .from(products)
    .innerJoin(stores, eq(stores.id, products.storeId))
    .where(and(eq(products.shortCode, parsed.data), eq(products.isActive, true)))
    .limit(1);
  return row ?? null;
}
