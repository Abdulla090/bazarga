import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../db";
import { deliveryZones, storePaymentMethods } from "../db/schema";
import { AppError } from "../errors";
import type { LocalizedText } from "@/lib/i18n";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/order-status";

// ---------------------------------------------------------------- delivery zones
export async function listZones(database: Db, storeId: string, opts: { activeOnly?: boolean } = {}) {
  return database.query.deliveryZones.findMany({
    where: opts.activeOnly
      ? and(eq(deliveryZones.storeId, storeId), eq(deliveryZones.isActive, true))
      : eq(deliveryZones.storeId, storeId),
    orderBy: [asc(deliveryZones.sort), asc(deliveryZones.cityKey)],
  });
}

export async function upsertZone(
  database: Db,
  storeId: string,
  input: { cityKey: string; name: LocalizedText; fee: number; isActive: boolean },
) {
  const [z] = await database
    .insert(deliveryZones)
    .values({ storeId, ...input, sort: 100 })
    .onConflictDoUpdate({
      target: [deliveryZones.storeId, deliveryZones.cityKey],
      set: { name: input.name, fee: input.fee, isActive: input.isActive },
    })
    .returning();
  return z!;
}

export async function updateZoneFee(database: Db, storeId: string, zoneId: string, fee: number, isActive: boolean) {
  const r = await database
    .update(deliveryZones)
    .set({ fee, isActive })
    .where(and(eq(deliveryZones.id, zoneId), eq(deliveryZones.storeId, storeId)))
    .returning({ id: deliveryZones.id });
  if (!r.length) throw new AppError("NOT_FOUND");
}

export async function deleteZone(database: Db, storeId: string, zoneId: string) {
  const r = await database
    .delete(deliveryZones)
    .where(and(eq(deliveryZones.id, zoneId), eq(deliveryZones.storeId, storeId)))
    .returning({ id: deliveryZones.id });
  if (!r.length) throw new AppError("NOT_FOUND");
}

// ---------------------------------------------------------------- payment methods
export async function listPaymentMethods(database: Db, storeId: string) {
  const rows = await database.query.storePaymentMethods.findMany({ where: eq(storePaymentMethods.storeId, storeId) });
  return PAYMENT_METHODS.map((m) => ({ method: m, enabled: rows.find((r) => r.method === m)?.enabled ?? false }));
}

export async function setPaymentMethod(database: Db, storeId: string, method: PaymentMethod, enabled: boolean) {
  await database
    .insert(storePaymentMethods)
    .values({ storeId, method, enabled })
    .onConflictDoUpdate({
      target: [storePaymentMethods.storeId, storePaymentMethods.method],
      set: { enabled, updatedAt: new Date() },
    });
}
