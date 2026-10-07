import { and, desc, eq, ne } from "drizzle-orm";
import type { Db } from "../db";
import { discountCodes } from "../db/schema";
import { AppError } from "../errors";
import type { DiscountCodeInput } from "@/lib/validation";

/**
 * Seller-side discount code management (dashboard → Discounts). Every query is scoped by storeId;
 * a code id from another store behaves exactly like a missing one (NOT_FOUND).
 */
export async function listDiscountCodes(database: Db, storeId: string) {
  return database.query.discountCodes.findMany({
    where: eq(discountCodes.storeId, storeId),
    orderBy: [desc(discountCodes.isActive), desc(discountCodes.createdAt)],
  });
}

async function assertCodeFree(database: Db, storeId: string, code: string, exceptId?: string) {
  const clash = await database.query.discountCodes.findFirst({
    where: exceptId
      ? and(eq(discountCodes.storeId, storeId), eq(discountCodes.code, code), ne(discountCodes.id, exceptId))
      : and(eq(discountCodes.storeId, storeId), eq(discountCodes.code, code)),
    columns: { id: true },
  });
  if (clash) throw new AppError("CONFLICT", "discount_code_taken");
}

/** Postgres unique violation (a concurrent save won the race for the same code). */
function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string; cause?: { code?: string } } | null)?.code ?? (e as { cause?: { code?: string } } | null)?.cause?.code;
  return code === "23505";
}

export async function createDiscountCode(database: Db, storeId: string, input: DiscountCodeInput) {
  await assertCodeFree(database, storeId, input.code);
  try {
    const [row] = await database.insert(discountCodes).values({ storeId, ...input }).returning();
    return row!;
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("CONFLICT", "discount_code_taken");
    throw e;
  }
}

/** Edit everything but the use counter (uses already made stay counted). */
export async function updateDiscountCode(database: Db, storeId: string, id: string, input: DiscountCodeInput) {
  await assertCodeFree(database, storeId, input.code, id);
  try {
    const [row] = await database
      .update(discountCodes)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(discountCodes.id, id), eq(discountCodes.storeId, storeId)))
      .returning();
    if (!row) throw new AppError("NOT_FOUND");
    return row;
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("CONFLICT", "discount_code_taken");
    throw e;
  }
}

/** Deactivate / reactivate. Codes are never hard-deleted from the dashboard: past orders keep pointing at them. */
export async function setDiscountCodeActive(database: Db, storeId: string, id: string, isActive: boolean) {
  const r = await database
    .update(discountCodes)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(discountCodes.id, id), eq(discountCodes.storeId, storeId)))
    .returning({ id: discountCodes.id });
  if (!r.length) throw new AppError("NOT_FOUND");
}
