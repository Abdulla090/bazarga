import { and, eq, isNotNull, lt, ne } from "drizzle-orm";
import type { Db } from "../db";
import { stores, storePlanHistory } from "../db/schema";

/** Downgrade paid stores whose plan_period_end has passed back to free; one history row each. Idempotent. */
export async function expireLapsedPlans(db: Db, now: Date = new Date()): Promise<{ expired: number }> {
  const lapsed = await db
    .select({ id: stores.id, plan: stores.plan, end: stores.planPeriodEnd })
    .from(stores)
    .where(and(ne(stores.plan, "free"), isNotNull(stores.planPeriodEnd), lt(stores.planPeriodEnd, now)));
  let expired = 0;
  for (const s of lapsed) {
    await db.transaction(async (tx) => {
      const res = await tx
        .update(stores)
        .set({ plan: "free" })
        .where(and(eq(stores.id, s.id), eq(stores.plan, s.plan), lt(stores.planPeriodEnd, now)))
        .returning({ id: stores.id });
      if (res.length === 0) return;
      await tx.insert(storePlanHistory).values({ storeId: s.id, fromPlan: s.plan, toPlan: "free", periodEnd: s.end, reason: "expired" });
      expired++;
    });
  }
  return { expired };
}
