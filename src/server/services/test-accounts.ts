import { and, eq, ilike, inArray, lt, ne, or, sql } from "drizzle-orm";
import type { Db } from "@/server/db";
import { adminAudit, auditLog, orders, stores, users } from "@/server/db/schema";
import { TEST_EMAIL_DOMAIN } from "@/lib/live-stats";

/**
 * Test-account hygiene for the live database (scripts/cleanup-test-accounts.ts). Every e2e/gate/smoke/audit spec signs
 * up with a throwaway `…@example.com` address, so that domain is the one rule: a real seller can never own it
 * (RFC 2606 reserves it). The demo seller and any platform owner are never touched.
 */
export const DEMO_EMAIL = "demo@mymarket.app";
/** Customer names the e2e specs use for orders placed on the demo store (e2e/social-first.spec.mjs). */
export const TEST_ORDER_NAME_PATTERNS = ["Social Test %"];

export function isTestAccountEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return e !== DEMO_EMAIL && e.endsWith(TEST_EMAIL_DOMAIN);
}

export type CleanupResult = { users: string[]; demoOrders: number; adminAudit: number };

/**
 * Delete test accounts older than `minAgeMinutes` (so a spec that is running right now keeps its account) plus everything
 * they own — stores, products, orders, sessions… all cascade from users/stores. Also removes audit rows the tests leave
 * behind and the e2e orders placed on the demo store. `dryRun` reports without deleting. One transaction.
 */
export async function cleanupTestAccounts(db: Db, opts: { minAgeMinutes?: number; dryRun?: boolean; now?: Date } = {}): Promise<CleanupResult> {
  const cutoff = new Date((opts.now ?? new Date()).getTime() - (opts.minAgeMinutes ?? 30) * 60_000);
  return db.transaction(async (tx) => {
    const victims = await tx
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(ilike(users.email, `%${TEST_EMAIL_DOMAIN}`), ne(users.email, DEMO_EMAIL), ne(users.role, "owner"), lt(users.createdAt, cutoff)));
    const ids = victims.map((v) => v.id);
    const emails = victims.map((v) => v.email.toLowerCase());

    const demoStoreIds = (
      await tx.select({ id: stores.id }).from(stores).innerJoin(users, eq(users.id, stores.ownerId)).where(eq(users.email, DEMO_EMAIL))
    ).map((s) => s.id);
    const demoOrderWhere = demoStoreIds.length
      ? and(inArray(orders.storeId, demoStoreIds), lt(orders.createdAt, cutoff), or(...TEST_ORDER_NAME_PATTERNS.map((p) => ilike(orders.customerName, p))))
      : undefined;
    const auditWhere = or(
      and(eq(adminAudit.targetType, "user"), ilike(adminAudit.targetLabel, `%${TEST_EMAIL_DOMAIN}`), lt(adminAudit.createdAt, cutoff)),
      ids.length ? inArray(adminAudit.actorId, ids) : sql`false`,
    );

    if (opts.dryRun) {
      const demoOrders = demoOrderWhere ? (await tx.select({ n: sql<number>`count(*)::int` }).from(orders).where(demoOrderWhere))[0]?.n ?? 0 : 0;
      const audits = (await tx.select({ n: sql<number>`count(*)::int` }).from(adminAudit).where(auditWhere))[0]?.n ?? 0;
      return { users: emails, demoOrders, adminAudit: audits };
    }

    const delOrders = demoOrderWhere ? await tx.delete(orders).where(demoOrderWhere).returning({ id: orders.id }) : [];
    const delAudit = await tx.delete(adminAudit).where(auditWhere).returning({ id: adminAudit.id });
    if (ids.length) {
      await tx.delete(auditLog).where(inArray(auditLog.userId, ids)); // audit_log.user_id has no FK
      await tx.delete(users).where(inArray(users.id, ids)); // cascades: stores → products, orders, customers…; sessions, tokens
    }
    return { users: emails, demoOrders: delOrders.length, adminAudit: delAudit.length };
  });
}
