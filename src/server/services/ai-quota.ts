import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import { aiUsage, stores } from "../db/schema";
import { AppError } from "../errors";
import { AI_MONTHLY_LIMIT, normalizePlan, type AiFeature, type PlanId } from "@/lib/plans";
import { studioPeriod } from "./studio-quota";

export type AiUsage = { plan: PlanId; feature: AiFeature; period: string; used: number; limit: number; remaining: number };

async function planOf(db: Db, storeId: string): Promise<PlanId> {
  const [st] = await db.select({ plan: stores.plan }).from(stores).where(eq(stores.id, storeId));
  if (!st) throw new AppError("NOT_FOUND");
  return normalizePlan(st.plan);
}

/** This month's AI credits for one feature (Baghdad month, same clock as Product Studio). */
export async function getAiUsage(db: Db, storeId: string, feature: AiFeature, now: Date = new Date()): Promise<AiUsage> {
  const plan = await planOf(db, storeId);
  const period = studioPeriod(now);
  const [row] = await db
    .select({ used: aiUsage.used })
    .from(aiUsage)
    .where(and(eq(aiUsage.storeId, storeId), eq(aiUsage.feature, feature), eq(aiUsage.period, period)));
  const used = row?.used ?? 0;
  const limit = AI_MONTHLY_LIMIT[feature][plan];
  return { plan, feature, period, used, limit, remaining: Math.max(0, limit - used) };
}

/** Spend one credit atomically (never overshoots under concurrency). Throws VALIDATION "plan_limit_ai" when used up. */
export async function consumeAiCredit(db: Db, storeId: string, feature: AiFeature, now: Date = new Date()): Promise<AiUsage> {
  const plan = await planOf(db, storeId);
  const limit = AI_MONTHLY_LIMIT[feature][plan];
  const period = studioPeriod(now);
  if (limit <= 0) throw new AppError("VALIDATION", "plan_limit_ai");
  const rows = await db
    .insert(aiUsage)
    .values({ storeId, feature, period, used: 1 })
    .onConflictDoUpdate({
      target: [aiUsage.storeId, aiUsage.feature, aiUsage.period],
      set: { used: sql`${aiUsage.used} + 1`, updatedAt: now },
      setWhere: sql`${aiUsage.used} < ${limit}`,
    })
    .returning({ used: aiUsage.used });
  const used = rows[0]?.used;
  if (used === undefined) throw new AppError("VALIDATION", "plan_limit_ai");
  return { plan, feature, period, used, limit, remaining: Math.max(0, limit - used) };
}

/** Give one credit back (the provider failed after consume). */
export async function refundAiCredit(db: Db, storeId: string, feature: AiFeature, now: Date = new Date()): Promise<void> {
  await db
    .update(aiUsage)
    .set({ used: sql`greatest(${aiUsage.used} - 1, 0)`, updatedAt: now })
    .where(and(eq(aiUsage.storeId, storeId), eq(aiUsage.feature, feature), eq(aiUsage.period, studioPeriod(now))));
}
