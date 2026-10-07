import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../db";
import { deliveryAreas, deliveryZones, storePaymentMethods } from "../db/schema";
import { AppError } from "../errors";
import type { LocalizedText } from "@/lib/i18n";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/order-status";
import { governorateForCityKey } from "@/lib/governorates";

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
    .values({ storeId, ...input, governorateKey: governorateForCityKey(input.cityKey), sort: 100 })
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

// ---------------------------------------------------------------- delivery areas (per city zone)
/** All areas of the store (active or not), for the dashboard; grouped by zone by the caller. */
export async function listAreas(database: Db, storeId: string) {
  return database.query.deliveryAreas.findMany({
    where: eq(deliveryAreas.storeId, storeId),
    orderBy: [asc(deliveryAreas.sort), asc(deliveryAreas.createdAt)],
  });
}

/** Add an area to one of *this store's* zones (a zone id from another store is NOT_FOUND). */
export async function addArea(database: Db, storeId: string, zoneId: string, input: { name: LocalizedText; fee: number | null }) {
  const zone = await database.query.deliveryZones.findFirst({
    where: and(eq(deliveryZones.id, zoneId), eq(deliveryZones.storeId, storeId)),
    columns: { id: true },
  });
  if (!zone) throw new AppError("NOT_FOUND");
  const [a] = await database.insert(deliveryAreas).values({ storeId, zoneId, name: input.name, fee: input.fee, sort: 100 }).returning();
  return a!;
}

/**
 * Rename / change the fee override (null = the city's fee). Locales not on the form (e.g. ar/kmr when the
 * dashboard edits ku + en) are kept, so a rename never silently drops a translation.
 */
export async function updateArea(
  database: Db,
  storeId: string,
  areaId: string,
  input: { name: LocalizedText; fee: number | null },
  editedLocales: readonly string[] = ["ku", "ar", "en", "kmr"],
) {
  const existing = await database.query.deliveryAreas.findFirst({
    where: and(eq(deliveryAreas.id, areaId), eq(deliveryAreas.storeId, storeId)),
  });
  if (!existing) throw new AppError("NOT_FOUND");
  const kept = Object.fromEntries(Object.entries(existing.name).filter(([l]) => !editedLocales.includes(l)));
  const name = { ...kept, ...input.name };
  if (!Object.values(name).some((v) => v && v.trim())) throw new AppError("VALIDATION", "name_required");
  const [a] = await database
    .update(deliveryAreas)
    .set({ name, fee: input.fee })
    .where(and(eq(deliveryAreas.id, areaId), eq(deliveryAreas.storeId, storeId)))
    .returning();
  return a!;
}

/** Remove an area. Past orders keep their area name (orders.area_id is set null by the FK). */
export async function deleteArea(database: Db, storeId: string, areaId: string) {
  const r = await database
    .delete(deliveryAreas)
    .where(and(eq(deliveryAreas.id, areaId), eq(deliveryAreas.storeId, storeId)))
    .returning({ id: deliveryAreas.id });
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
