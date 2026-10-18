import { withOverride } from "./limit-overrides";
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import { productStudioUsage, stores } from "../db/schema";
import { AppError } from "../errors";
import { normalizePlan, studioEditsLimit, type PlanId } from "@/lib/plans";

/** Baghdad is UTC+3 all year (no DST), so the quota month flips at local midnight on the 1st. */
const BAGHDAD_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Quota period "YYYY-MM" in Asia/Baghdad. */
export function studioPeriod(now: Date = new Date()): string {
  const d = new Date(now.getTime() + BAGHDAD_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type StudioUsage = { plan: PlanId; period: string; used: number; limit: number; remaining: number };

async function planOf(db: Db, storeId: string): Promise<PlanId> {
  const [st] = await db.select({ plan: stores.plan }).from(stores).where(eq(stores.id, storeId));
  if (!st) throw new AppError("NOT_FOUND");
  return normalizePlan(st.plan);
}

/** This month's Product Studio usage for a store (0/10/100/100 edits by plan). */
export async function getStudioUsage(db: Db, storeId: string, now: Date = new Date()): Promise<StudioUsage> {
  const plan = await planOf(db, storeId);
  const period = studioPeriod(now);
  const [row] = await db
    .select({ used: productStudioUsage.used })
    .from(productStudioUsage)
    .where(and(eq(productStudioUsage.storeId, storeId), eq(productStudioUsage.period, period)));
  const used = row?.used ?? 0;
  const limit = await withOverride(db, storeId, "studioEdits", studioEditsLimit(plan));
  return { plan, period, used, limit, remaining: Math.max(0, limit - used) };
}

/**
 * Spend one Product Studio edit. Atomic: a single upsert that only increments while `used < limit`, so concurrent
 * edits can never overshoot the quota. Throws VALIDATION "plan_limit_studio" when the month's quota is used up
 * (or the plan has none). Call it before running the (paid) AI edit; refund with `refundStudioEdit` if the edit fails.
 */
export async function consumeStudioEdit(db: Db, storeId: string, now: Date = new Date()): Promise<StudioUsage> {
  const plan = await planOf(db, storeId);
  const limit = await withOverride(db, storeId, "studioEdits", studioEditsLimit(plan));
  const period = studioPeriod(now);
  if (limit <= 0) throw new AppError("VALIDATION", "plan_limit_studio");
  const rows = await db
    .insert(productStudioUsage)
    .values({ storeId, period, used: 1 })
    .onConflictDoUpdate({
      target: [productStudioUsage.storeId, productStudioUsage.period],
      set: { used: sql`${productStudioUsage.used} + 1`, updatedAt: now },
      setWhere: sql`${productStudioUsage.used} < ${limit}`,
    })
    .returning({ used: productStudioUsage.used });
  const used = rows[0]?.used;
  if (used === undefined) throw new AppError("VALIDATION", "plan_limit_studio");
  return { plan, period, used, limit, remaining: Math.max(0, limit - used) };
}

/** Give one edit back (the AI call failed after `consumeStudioEdit`). Never goes below zero. */
export async function refundStudioEdit(db: Db, storeId: string, now: Date = new Date()): Promise<void> {
  await db
    .update(productStudioUsage)
    .set({ used: sql`greatest(${productStudioUsage.used} - 1, 0)`, updatedAt: now })
    .where(and(eq(productStudioUsage.storeId, storeId), eq(productStudioUsage.period, studioPeriod(now))));
}
