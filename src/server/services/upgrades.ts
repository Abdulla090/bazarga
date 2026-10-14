import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db";
import { stores, storePlanHistory, upgradeRequests } from "../db/schema";
import { AppError } from "../errors";
import { PAID_PLAN_IDS } from "@/lib/plans";

export const upgradeInput = z.object({
  plan: z.enum(PAID_PLAN_IDS),
  months: z.union([z.literal(1), z.literal(12)]),
  method: z.enum(["fib", "zaincash", "cash", "online"]),
});
export type UpgradeInput = z.infer<typeof upgradeInput>;

/** Create (or replace) the store's single pending request. Tenant id comes from the session, never the client. */
export async function createUpgradeRequest(db: Db, storeId: string, raw: unknown) {
  const input = upgradeInput.parse(raw);
  return db.transaction(async (tx) => {
    await tx.delete(upgradeRequests).where(and(eq(upgradeRequests.storeId, storeId), eq(upgradeRequests.status, "pending")));
    const [row] = await tx.insert(upgradeRequests).values({ storeId, ...input }).returning();
    return row!;
  });
}

export async function pendingRequestFor(db: Db, storeId: string) {
  return db.query.upgradeRequests.findFirst({
    where: and(eq(upgradeRequests.storeId, storeId), eq(upgradeRequests.status, "pending")),
  });
}

export async function listRequests(db: Db, status: "pending" | "all" = "pending") {
  const rows = await db
    .select({ r: upgradeRequests, storeName: stores.name, slug: stores.slug, currentPlan: stores.plan, end: stores.planPeriodEnd })
    .from(upgradeRequests)
    .innerJoin(stores, eq(stores.id, upgradeRequests.storeId))
    .where(status === "pending" ? eq(upgradeRequests.status, "pending") : undefined)
    .orderBy(desc(upgradeRequests.createdAt))
    .limit(200);
  return rows;
}

/** Add `months` to a base date (calendar months, clamped to month end). */
export function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Activation core, run inside the caller's transaction (manual admin activation and the gateway webhook both use it):
 * extend from the current period end if the same plan is still active, else from now; write plan history.
 */
export async function activateRequestTx(tx: Tx, requestId: string, now: Date, reason?: string) {
  const req = await tx.query.upgradeRequests.findFirst({ where: eq(upgradeRequests.id, requestId) });
  if (!req) throw new AppError("NOT_FOUND");
  if (req.status !== "pending") return { already: true as const };
  const store = await tx.query.stores.findFirst({ where: eq(stores.id, req.storeId) });
  if (!store) throw new AppError("NOT_FOUND");
  const active = store.plan === req.plan && store.planPeriodEnd && store.planPeriodEnd > now;
  const end = addMonths(active ? store.planPeriodEnd! : now, req.months);
  await tx.update(stores).set({ plan: req.plan, planPeriodEnd: end }).where(eq(stores.id, store.id));
  await tx.insert(storePlanHistory).values({ storeId: store.id, fromPlan: store.plan, toPlan: req.plan, periodEnd: end, reason: reason ?? `upgrade:${req.method}` });
  await tx.update(upgradeRequests).set({ status: "activated", resolvedAt: now }).where(eq(upgradeRequests.id, req.id));
  return { already: false as const, end };
}

/** Activate: extend from the current period end if still active (same plan), else from now. Idempotent per request. */
export async function activateRequest(db: Db, requestId: string, now: Date = new Date()) {
  return db.transaction(async (tx) => activateRequestTx(tx, requestId, now));
}

export async function rejectRequest(db: Db, requestId: string, note?: string) {
  await db
    .update(upgradeRequests)
    .set({ status: "rejected", resolvedAt: new Date(), note: note ?? null })
    .where(and(eq(upgradeRequests.id, requestId), eq(upgradeRequests.status, "pending")));
}
