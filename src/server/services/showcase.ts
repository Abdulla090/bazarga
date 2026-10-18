import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "../db";
import { products, stores, users } from "../db/schema";
import { SHOWCASE_LIMIT, type ShowcaseStore } from "@/lib/showcase";

const DEMO_EMAIL = (process.env.SEED_DEMO_EMAIL ?? "demo@mymarket.app").toLowerCase();

/**
 * Stores that opted in (stores.showcase_opt_in), are active and sell at least one active product. Admin-featured first, then founding stores,
 * then the most recently updated. Only public fields leave this function.
 */
export async function loadShowcaseStores(database: Db, limit = SHOWCASE_LIMIT): Promise<ShowcaseStore[]> {
  const productCount = sql<number>`(select count(*)::int from ${products} where ${products.storeId} = ${stores.id} and ${products.isActive} = true)`;
  const rows = await database
    .select({
      slug: stores.slug,
      name: stores.name,
      tagline: stores.tagline,
      city: stores.city,
      logoUrl: stores.logoUrl,
      coverUrl: stores.coverImageUrl,
      coverRenditions: stores.coverImageRenditions,
      coverPlaceholder: stores.coverImagePlaceholder,
      foundingNumber: stores.foundingNumber,
      ownerEmail: users.email,
      productCount,
    })
    .from(stores)
    .innerJoin(users, eq(users.id, stores.ownerId))
    .where(and(eq(stores.showcaseOptIn, true), eq(stores.isActive, true), isNull(stores.suspendedAt), sql`${productCount} > 0`))
    .orderBy(desc(stores.featured), sql`${stores.foundingNumber} asc nulls last`, desc(stores.updatedAt))
    .limit(Math.max(1, Math.min(limit, 100)));
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    tagline: (r.tagline ?? {}) as Record<string, string>,
    city: r.city,
    logoUrl: r.logoUrl,
    coverUrl: r.coverUrl,
    coverRenditions: r.coverRenditions ?? [],
    coverPlaceholder: r.coverPlaceholder,
    productCount: Number(r.productCount),
    foundingNumber: r.foundingNumber,
    isDemo: r.ownerEmail.toLowerCase() === DEMO_EMAIL,
  }));
}

/** Seller's own switch (dashboard settings). Scoped by store id from the session. */
export async function setShowcaseOptIn(database: Db, storeId: string, optIn: boolean): Promise<void> {
  await database.update(stores).set({ showcaseOptIn: optIn, updatedAt: new Date() }).where(eq(stores.id, storeId));
}
