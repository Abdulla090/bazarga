import { count, isNotNull, sql } from "drizzle-orm";
import type { Db } from "../db";
import { stores } from "../db/schema";
import { FOUNDING_SPOTS, foundingSpotsLeft, isFoundingEligibleEmail } from "@/lib/founding";

type Executor = Pick<Db, "execute">;

/**
 * Give a freshly created store the next founding number (1..100) when its owner is a real seller and spots remain.
 * Serialised with an advisory lock so two signups at once can't take the same number; the partial unique index is the backstop.
 */
export async function assignFoundingNumber(tx: Executor, storeId: string, ownerEmail: string): Promise<number | null> {
  if (!isFoundingEligibleEmail(ownerEmail)) return null;
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('founding-number'))`);
  const res = await tx.execute(sql`
    UPDATE stores SET founding_number = (SELECT COALESCE(MAX(founding_number), 0) + 1 FROM stores)
    WHERE id = ${storeId} AND founding_number IS NULL
      AND (SELECT COALESCE(MAX(founding_number), 0) FROM stores) < ${FOUNDING_SPOTS}
    RETURNING founding_number
  `);
  const rows = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows ?? []) as { founding_number: number }[];
  return rows[0]?.founding_number ?? null;
}

/** Founding spots still open (100 minus numbers handed out). */
export async function loadFoundingSpotsLeft(database: Db): Promise<number> {
  const [row] = await database.select({ n: count() }).from(stores).where(isNotNull(stores.foundingNumber));
  return foundingSpotsLeft(row?.n ?? 0) ?? 0;
}
