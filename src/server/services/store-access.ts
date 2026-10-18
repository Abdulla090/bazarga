import { withOverrides } from "./limit-overrides";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import type { Db } from "../db";
import { storePlanHistory, stores } from "../db/schema";
import { AppError } from "../errors";
import { PLAN_RANK, STORE_LIMIT, normalizePlan, type PlanId } from "@/lib/plans";
import type { StoreInput } from "@/lib/validation";
import { createStore, type Store } from "./stores";
import { memberStoreIds } from "./team";

/** Cookie holding the dashboard's current store id (multi-store accounts). Never trusted on its own: re-checked against access. */
export const CURRENT_STORE_COOKIE = "rc_store";

export type StoreRole = "owner" | "staff";
export type AccessibleStore = { store: Store; role: StoreRole };

/** Every store the user can open in the dashboard, oldest first: owned stores, then stores they joined as staff. */
export async function listAccessibleStores(database: Db, userId: string): Promise<AccessibleStore[]> {
  const owned = await database.query.stores.findMany({ where: eq(stores.ownerId, userId), orderBy: asc(stores.createdAt) });
  const out: AccessibleStore[] = owned.map((store) => ({ store, role: "owner" }));
  for (const m of await memberStores(database, userId)) if (!out.some((o) => o.store.id === m.id)) out.push({ store: m, role: "staff" });
  return out;
}

async function memberStores(database: Db, userId: string): Promise<Store[]> {
  const ids = await memberStoreIds(database, userId);
  if (!ids.length) return [];
  return database.query.stores.findMany({ where: inArray(stores.id, ids), orderBy: asc(stores.createdAt) });
}

/** The dashboard's current store: the cookie's store when the user can access it, else their first store. */
export async function resolveCurrentStore(database: Db, userId: string, preferredId: string | null | undefined): Promise<AccessibleStore | null> {
  const all = await listAccessibleStores(database, userId);
  return all.find((a) => a.store.id === preferredId) ?? all[0] ?? null;
}

/** Highest plan across the stores a user owns (it decides how many stores the account may have). */
export function bestPlan(plans: (string | null | undefined)[]): PlanId {
  return plans.map(normalizePlan).reduce<PlanId>((best, p) => (PLAN_RANK[p] > PLAN_RANK[best] ? p : best), "free");
}

export async function ownedStoreUsage(database: Db, ownerId: string) {
  const owned = await database.select({ id: stores.id, plan: stores.plan, planPeriodEnd: stores.planPeriodEnd }).from(stores).where(eq(stores.ownerId, ownerId)).orderBy(asc(stores.createdAt));
  const plan = bestPlan(owned.map((s) => s.plan));
  return { used: owned.length, limit: await withOverrides(database, owned.map((s) => s.id), "stores", STORE_LIMIT[plan]), plan, owned };
}

/**
 * Create one more store for an existing seller. Server-side limit: STORE_LIMIT of the account's best plan
 * (Free/Pro 1, Business 3, Max 5); over it → FORBIDDEN "plan_limit_stores". The new store shares that plan and its
 * period end, so the stores renew and expire together.
 */
export async function createAdditionalStore(database: Db, ownerId: string, input: StoreInput): Promise<Store> {
  const u = await ownedStoreUsage(database, ownerId);
  if (u.used >= u.limit) throw new AppError("FORBIDDEN", "plan_limit_stores");
  const created = await createStore(database, ownerId, input);
  if (u.plan !== "free") {
    const src = u.owned.find((s) => normalizePlan(s.plan) === u.plan);
    const [row] = await database.update(stores).set({ plan: u.plan, planPeriodEnd: src?.planPeriodEnd ?? null }).where(eq(stores.id, created.id)).returning();
    await database.insert(storePlanHistory).values({ storeId: created.id, fromPlan: "free", toPlan: u.plan, periodEnd: src?.planPeriodEnd ?? null, reason: "multi_store:inherit" });
    return row ?? created;
  }
  return created;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/**
 * After a plan is activated on one store, the owner's other stores (oldest first, up to the plan's store limit)
 * get the same plan and period end. Stores beyond the limit keep what they had.
 */
export async function syncSiblingPlans(tx: Tx | Db, ownerId: string, storeId: string, plan: PlanId, periodEnd: Date | null) {
  const limit = STORE_LIMIT[plan];
  if (limit <= 1) return 0;
  const sib = await tx.select({ id: stores.id }).from(stores).where(and(eq(stores.ownerId, ownerId), ne(stores.id, storeId))).orderBy(asc(stores.createdAt)).limit(limit - 1);
  if (!sib.length) return 0;
  await tx.update(stores).set({ plan, planPeriodEnd: periodEnd }).where(inArray(stores.id, sib.map((s) => s.id)));
  return sib.length;
}
