import { and, count, eq, isNull } from "drizzle-orm";
import type { Db } from "../db";
import { deliveryAreas, deliveryZones, orders, products, stores } from "../db/schema";
import { AppError } from "../errors";
import { IRAQI_CITIES } from "@/lib/cities";
import { buildSetupChecklist, isDeliveryCustomized, type SetupChecklist, type SetupFacts } from "@/lib/setup-checklist";

/** Every query is scoped by `storeId` (from the session), like every other service. */
export async function loadSetupFacts(database: Db, storeId: string): Promise<SetupFacts> {
  const [store, productRows, zones, areaRows, orderRows] = await Promise.all([
    database.query.stores.findFirst({
      where: eq(stores.id, storeId),
      columns: { logoUrl: true, whatsapp: true, linkSharedAt: true, deliveryConfirmedAt: true },
    }),
    database.select({ n: count() }).from(products).where(and(eq(products.storeId, storeId), eq(products.isActive, true))),
    database.query.deliveryZones.findMany({
      where: eq(deliveryZones.storeId, storeId),
      columns: { cityKey: true, fee: true, isActive: true, etaMinDays: true, etaMaxDays: true },
    }),
    database.select({ n: count() }).from(deliveryAreas).where(eq(deliveryAreas.storeId, storeId)),
    database.select({ n: count() }).from(orders).where(eq(orders.storeId, storeId)),
  ]);
  if (!store) throw new AppError("NOT_FOUND");
  const areaCount = Number(areaRows[0]?.n ?? 0);
  return {
    logoUrl: store.logoUrl,
    activeProductCount: Number(productRows[0]?.n ?? 0),
    deliveryCustomized: isDeliveryCustomized(zones, areaCount, IRAQI_CITIES),
    deliveryConfirmedAt: store.deliveryConfirmedAt,
    whatsapp: store.whatsapp,
    linkSharedAt: store.linkSharedAt,
    orderCount: Number(orderRows[0]?.n ?? 0),
  };
}

export async function getSetupChecklist(database: Db, storeId: string): Promise<SetupChecklist> {
  return buildSetupChecklist(await loadSetupFacts(database, storeId));
}

/** Records the first share only (later copies keep the original time). Returns true when this call recorded it. */
export async function markLinkShared(database: Db, storeId: string, now = new Date()): Promise<boolean> {
  const rows = await database
    .update(stores)
    .set({ linkSharedAt: now })
    .where(and(eq(stores.id, storeId), isNull(stores.linkSharedAt)))
    .returning({ id: stores.id });
  return rows.length > 0;
}

/** "The default delivery fees are right for me." Idempotent. */
export async function confirmDeliveryFees(database: Db, storeId: string, now = new Date()): Promise<boolean> {
  const rows = await database
    .update(stores)
    .set({ deliveryConfirmedAt: now })
    .where(and(eq(stores.id, storeId), isNull(stores.deliveryConfirmedAt)))
    .returning({ id: stores.id });
  return rows.length > 0;
}
