import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db";
import { storeBlockedPhones } from "../db/schema";
import { AppError } from "../errors";
import { normalizeIraqiMobile } from "@/lib/phone";

/**
 * Per-store phone blocklist (fake COD orders). Every function takes the store id from the caller's session;
 * a store can only read or change its own list. Phones are stored like orders store them: "+9647…".
 */
export type BlockedPhone = typeof storeBlockedPhones.$inferSelect;

function toE164(raw: string): string {
  const r = normalizeIraqiMobile(raw);
  if (!r.ok) throw new AppError("VALIDATION", r.reason);
  return r.e164;
}

export async function listBlockedPhones(database: Db, storeId: string): Promise<BlockedPhone[]> {
  return database.query.storeBlockedPhones.findMany({
    where: eq(storeBlockedPhones.storeId, storeId),
    orderBy: desc(storeBlockedPhones.createdAt),
    limit: 500,
  });
}

export async function isPhoneBlocked(database: Db, storeId: string, phone: string): Promise<boolean> {
  const row = await database.query.storeBlockedPhones.findFirst({
    where: and(eq(storeBlockedPhones.storeId, storeId), eq(storeBlockedPhones.phone, phone)),
    columns: { id: true },
  });
  return !!row;
}

/** Idempotent: blocking a number twice keeps the first row (and its note). Returns the stored E.164 phone. */
export async function blockPhone(database: Db, storeId: string, rawPhone: string, note?: string | null): Promise<string> {
  const phone = toE164(rawPhone);
  await database
    .insert(storeBlockedPhones)
    .values({ storeId, phone, note: note?.trim().slice(0, 200) || null })
    .onConflictDoNothing({ target: [storeBlockedPhones.storeId, storeBlockedPhones.phone] });
  return phone;
}

export async function unblockPhone(database: Db, storeId: string, rawPhone: string): Promise<boolean> {
  const phone = toE164(rawPhone);
  const rows = await database
    .delete(storeBlockedPhones)
    .where(and(eq(storeBlockedPhones.storeId, storeId), eq(storeBlockedPhones.phone, phone)))
    .returning({ id: storeBlockedPhones.id });
  return rows.length > 0;
}
