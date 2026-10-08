import { and, asc, desc, eq, inArray, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import type { Db } from "../db";
import { orders, paymentTransactions } from "../db/schema";
import { isAppError } from "../errors";
import { logger } from "../logger";
import { updateOrderStatus } from "../services/orders";
import { applyPaymentStatus } from "./service";
import { getProvider } from "./registry";
import type { PaymentProvider } from "./types";
import type { PaymentMethod } from "@/lib/order-status";

/**
 * Payment reconciliation + abandoned-order expiry for online payments (FIB, ZainCash, …). Run by
 * POST /api/cron/payments (Bearer CRON_SECRET) or `npm run payments:reconcile`; both call runPaymentJobs().
 *
 * Reconcile: pending attempts older than RECONCILE_AFTER_MS ask the provider for the authoritative status
 * (never trusting anything else) and apply it through applyPaymentStatus, which is idempotent and only allows
 * forward transitions — so racing a webhook, a redirect, the shopper's "I paid" button or a second cron run is safe.
 * Each attempt is checked at most every RECONCILE_EVERY_MS and RECONCILE_MAX_CHECKS times.
 *
 * Expire: online orders still `pending` (not confirmed by the seller) and not paid TTL minutes after checkout get a
 * last provider check; if still unpaid they are cancelled through updateOrderStatus — the same path as a seller
 * cancel, so stock goes back exactly once (orders.restocked_at) and the history shows why. Their pending attempts
 * are marked failed locally; a late provider "paid" still wins (failed → paid is allowed) and the seller sees
 * "paid after it expired" on the order. Providers that aren't configured are never called.
 */
export const RECONCILE_AFTER_MS = 2 * 60_000;
export const RECONCILE_EVERY_MS = 5 * 60_000;
export const RECONCILE_MAX_CHECKS = 48;
export const RECONCILE_BATCH = 50;
export const EXPIRY_BATCH = 100;
export const EXPIRED_NOTE = "expired: online payment not completed";

type ProviderFor = (m: PaymentMethod) => PaymentProvider;
type JobOpts = { now?: Date; providerFor?: ProviderFor };

const callable = (p: PaymentProvider | undefined): p is PaymentProvider & Required<Pick<PaymentProvider, "fetchStatus">> =>
  !!p && p.isConfigured() && typeof p.fetchStatus === "function";

export type ReconcileResult = { checked: number; paid: number; failed: number; unchanged: number; errors: number; skipped: number };

/** Ask providers about pending attempts that are due a check. */
export async function reconcilePendingPayments(database: Db, opts: JobOpts & { limit?: number } = {}): Promise<ReconcileResult> {
  const now = opts.now ?? new Date();
  const providerFor = opts.providerFor ?? getProvider;
  const res: ReconcileResult = { checked: 0, paid: 0, failed: 0, unchanged: 0, errors: 0, skipped: 0 };
  const due = await database
    .select({ id: paymentTransactions.id, provider: paymentTransactions.provider, providerRef: paymentTransactions.providerRef, checkCount: paymentTransactions.checkCount })
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.status, "pending"),
        ne(paymentTransactions.provider, "cod"),
        lte(paymentTransactions.createdAt, new Date(now.getTime() - RECONCILE_AFTER_MS)),
        lt(paymentTransactions.checkCount, RECONCILE_MAX_CHECKS),
        or(isNull(paymentTransactions.lastCheckedAt), lte(paymentTransactions.lastCheckedAt, new Date(now.getTime() - RECONCILE_EVERY_MS))),
      ),
    )
    .orderBy(asc(paymentTransactions.createdAt))
    .limit(opts.limit ?? RECONCILE_BATCH);

  for (const tx of due) {
    const provider = providerFor(tx.provider);
    if (!callable(provider)) {
      res.skipped++;
      continue;
    }
    // Claim the check first (bookkeeping + a second concurrent run skips it).
    const claimed = await database
      .update(paymentTransactions)
      .set({ lastCheckedAt: now, checkCount: sql`${paymentTransactions.checkCount} + 1` })
      .where(and(eq(paymentTransactions.id, tx.id), eq(paymentTransactions.checkCount, tx.checkCount)))
      .returning({ id: paymentTransactions.id });
    if (!claimed.length) {
      res.skipped++;
      continue;
    }
    res.checked++;
    try {
      const { status, raw } = await provider.fetchStatus(tx.providerRef);
      const r = await applyPaymentStatus(database, tx.provider, tx.providerRef, status, { ...raw, via: "reconcile" });
      if (r.changed && r.status === "paid") res.paid++;
      else if (r.changed && r.status === "failed") res.failed++;
      else res.unchanged++;
    } catch (err) {
      res.errors++;
      logger.warn("payment.reconcile_failed", { provider: tx.provider, providerRef: tx.providerRef, err });
    }
  }
  if (res.checked || res.errors) logger.info("payment.reconciled", res);
  return res;
}

export type ExpiryResult = { expired: number; paidLate: number; skipped: number; errors: number };

/** Cancel online orders left unpaid for `ttlMinutes`, releasing their stock. */
export async function expireAbandonedOrders(database: Db, opts: JobOpts & { ttlMinutes: number; limit?: number }): Promise<ExpiryResult> {
  const now = opts.now ?? new Date();
  const providerFor = opts.providerFor ?? getProvider;
  const res: ExpiryResult = { expired: 0, paidLate: 0, skipped: 0, errors: 0 };
  const cutoff = new Date(now.getTime() - opts.ttlMinutes * 60_000);
  const stale = await database
    .select({ id: orders.id, storeId: orders.storeId })
    .from(orders)
    .where(
      and(
        ne(orders.paymentMethod, "cod"),
        eq(orders.status, "pending"),
        inArray(orders.paymentStatus, ["unpaid", "pending", "failed"]),
        lte(orders.createdAt, cutoff),
        isNull(orders.expiredAt),
      ),
    )
    .orderBy(asc(orders.createdAt))
    .limit(opts.limit ?? EXPIRY_BATCH);

  for (const o of stale) {
    try {
      // Last word from the provider for every still-pending attempt: a payment that just went through wins.
      const pending = await database
        .select({ provider: paymentTransactions.provider, providerRef: paymentTransactions.providerRef })
        .from(paymentTransactions)
        .where(and(eq(paymentTransactions.orderId, o.id), eq(paymentTransactions.storeId, o.storeId), eq(paymentTransactions.status, "pending")))
        .orderBy(desc(paymentTransactions.createdAt));
      let paid = false;
      for (const tx of pending) {
        const provider = providerFor(tx.provider);
        if (!callable(provider)) continue;
        try {
          const { status, raw } = await provider.fetchStatus(tx.providerRef);
          const r = await applyPaymentStatus(database, tx.provider, tx.providerRef, status, { ...raw, via: "expiry" });
          if (r.status === "paid") paid = true;
        } catch (err) {
          logger.warn("payment.expiry_check_failed", { provider: tx.provider, providerRef: tx.providerRef, err });
        }
      }
      if (paid) {
        res.paidLate++;
        continue;
      }
      await updateOrderStatus(database, o.storeId, o.id, "cancelled", null, EXPIRED_NOTE);
      await database.update(orders).set({ expiredAt: now }).where(and(eq(orders.id, o.id), eq(orders.storeId, o.storeId)));
      // Close the open attempts locally so they aren't polled forever; a late provider "paid" can still land.
      for (const tx of pending) {
        await applyPaymentStatus(database, tx.provider, tx.providerRef, "failed", { via: "expiry", expiredAt: now.toISOString() }).catch(() => undefined);
      }
      const [after] = await database.select({ ps: orders.paymentStatus }).from(orders).where(eq(orders.id, o.id));
      if (after && after.ps !== "paid") {
        await database
          .update(orders)
          .set({ paymentStatus: "failed", updatedAt: now })
          .where(and(eq(orders.id, o.id), eq(orders.storeId, o.storeId), ne(orders.paymentStatus, "paid")));
      }
      res.expired++;
      logger.info("order.expired", { orderId: o.id, storeId: o.storeId });
    } catch (err) {
      // CONFLICT / invalid_transition: the seller or the shopper moved the order meanwhile — leave it alone.
      if (isAppError(err) && (err.code === "CONFLICT" || err.message === "invalid_transition")) res.skipped++;
      else {
        res.errors++;
        logger.warn("order.expiry_failed", { orderId: o.id, err });
      }
    }
  }
  return res;
}

export type PaymentJobsResult = { reconcile: ReconcileResult; expiry: ExpiryResult };

export async function runPaymentJobs(database: Db, opts: JobOpts & { ttlMinutes: number }): Promise<PaymentJobsResult> {
  const reconcile = await reconcilePendingPayments(database, opts);
  const expiry = await expireAbandonedOrders(database, opts);
  return { reconcile, expiry };
}
