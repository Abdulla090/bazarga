import { and, asc, eq, ne } from "drizzle-orm";
import type { Db } from "../db";
import { deliveryZones, storePaymentMethods, stores } from "../db/schema";
import { AppError } from "../errors";
import { IRAQI_CITIES } from "@/lib/cities";
import { PAYMENT_METHODS } from "@/lib/order-status";
import type { StoreInput } from "@/lib/validation";

export type Store = typeof stores.$inferSelect;

export async function getStoreForOwner(database: Db, ownerId: string): Promise<Store | null> {
  const s = await database.query.stores.findFirst({
    where: eq(stores.ownerId, ownerId),
    orderBy: asc(stores.createdAt),
  });
  return s ?? null;
}

export async function getStoreBySlug(database: Db, slug: string): Promise<Store | null> {
  const s = await database.query.stores.findFirst({ where: and(eq(stores.slug, slug), eq(stores.isActive, true)) });
  return s ?? null;
}

export async function isSlugAvailable(database: Db, slug: string, exceptStoreId?: string) {
  const s = await database.query.stores.findFirst({
    where: exceptStoreId ? and(eq(stores.slug, slug), ne(stores.id, exceptStoreId)) : eq(stores.slug, slug),
    columns: { id: true },
  });
  return !s;
}

/** Create a store with sensible defaults: Iraqi delivery zones and Cash on Delivery enabled. */
export async function createStore(database: Db, ownerId: string, input: StoreInput): Promise<Store> {
  if (!(await isSlugAvailable(database, input.slug))) throw new AppError("CONFLICT", "slug_taken");
  return database.transaction(async (tx) => {
    const [store] = await tx
      .insert(stores)
      .values({
        ownerId,
        name: input.name,
        slug: input.slug,
        defaultLocale: input.defaultLocale,
        phone: input.phone,
        whatsapp: input.whatsapp ?? input.phone,
        instagram: input.instagram,
        city: input.city,
        tagline: input.tagline ?? {},
      })
      .onConflictDoNothing()
      .returning();
    if (!store) throw new AppError("CONFLICT", "slug_taken");
    await tx.insert(deliveryZones).values(
      IRAQI_CITIES.map((c, i) => ({
        storeId: store.id,
        cityKey: c.key,
        governorateKey: c.governorateKey,
        name: c.name,
        fee: c.fee,
        sort: i,
      })),
    );
    await tx
      .insert(storePaymentMethods)
      .values(PAYMENT_METHODS.map((m) => ({ storeId: store.id, method: m, enabled: m === "cod" })));
    return store;
  });
}

export async function updateStore(
  database: Db,
  storeId: string,
  input: StoreInput & { logoUrl?: string | null },
): Promise<Store> {
  if (!(await isSlugAvailable(database, input.slug, storeId))) throw new AppError("CONFLICT", "slug_taken");
  const [s] = await database
    .update(stores)
    .set({
      name: input.name,
      slug: input.slug,
      defaultLocale: input.defaultLocale,
      phone: input.phone,
      whatsapp: input.whatsapp,
      instagram: input.instagram,
      city: input.city,
      tagline: input.tagline ?? {},
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      updatedAt: new Date(),
    })
    .where(eq(stores.id, storeId))
    .returning();
  if (!s) throw new AppError("NOT_FOUND");
  return s;
}
