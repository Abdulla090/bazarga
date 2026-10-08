import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db";
import { orders, paymentTransactions, webhookEvents } from "../db/schema";
import { AppError } from "../errors";
import { logger } from "../logger";
import type { PaymentMethod } from "@/lib/order-status";
import type { Locale } from "@/lib/i18n";
import type { NormalizedPaymentStatus, PaymentInit, PaymentProvider } from "./types";

const ALLOWED: Record<NormalizedPaymentStatus, NormalizedPaymentStatus[]> = {
  pending: ["paid", "failed"],
  failed: ["paid"], // a late success after a timeout/failed attempt still counts
  paid: ["refunded"],
  refunded: [],
};

/** Start an online payment attempt for an order and persist it as a pending transaction. */
export async function startPayment(
  database: Db,
  provider: PaymentProvider,
  order: { id: string; storeId: string; number: number; total: number; customerPhone: string; locale: Locale },
  opts: { storeName: string; returnUrl: string; callbackUrl: string },
): Promise<PaymentInit> {
  const attemptId = randomUUID();
  const init = await provider.createPayment({
    attemptId,
    orderId: order.id,
    orderNumber: order.number,
    amount: order.total,
    description: `${opts.storeName} #${order.number}`,
    locale: order.locale,
    customerPhone: order.customerPhone,
    returnUrl: opts.returnUrl,
    callbackUrl: opts.callbackUrl,
  });
  if (init.kind === "offline") return init;
  await database.insert(paymentTransactions).values({
    id: attemptId,
    orderId: order.id,
    storeId: order.storeId,
    provider: provider.id,
    providerRef: init.providerRef,
    status: "pending",
    amount: order.total,
    raw: { init: init.kind === "qr" ? { ...init, raw: undefined } : init.raw },
  });
  await database
    .update(orders)
    .set({ paymentStatus: "pending", updatedAt: new Date() })
    .where(and(eq(orders.id, order.id), eq(orders.paymentStatus, "unpaid")));
  return init;
}

/**
 * Idempotently apply a provider-confirmed status. Safe to call any number of times with the same
 * input (webhook retries, redirect + webhook racing): only allowed transitions change anything.
 */
export async function applyPaymentStatus(
  database: Db,
  provider: PaymentMethod,
  providerRef: string,
  status: NormalizedPaymentStatus,
  raw: Record<string, unknown> = {},
): Promise<{ changed: boolean; orderId: string; status: NormalizedPaymentStatus }> {
  return database.transaction(async (tx) => {
    const t = await tx.query.paymentTransactions.findFirst({
      where: and(eq(paymentTransactions.provider, provider), eq(paymentTransactions.providerRef, providerRef)),
    });
    if (!t) throw new AppError("NOT_FOUND", "payment_not_found");
    const current = t.status as NormalizedPaymentStatus;
    if (current === status || !ALLOWED[current].includes(status)) {
      return { changed: false, orderId: t.orderId, status: current };
    }
    const updated = await tx
      .update(paymentTransactions)
      .set({ status, raw: { ...t.raw, last: raw }, updatedAt: new Date() })
      .where(and(eq(paymentTransactions.id, t.id), eq(paymentTransactions.status, t.status)))
      .returning({ id: paymentTransactions.id });
    if (!updated.length) return { changed: false, orderId: t.orderId, status: current };

    // The order reflects its most recent attempt; a paid order is never downgraded by an older attempt failing.
    const order = await tx.query.orders.findFirst({ where: eq(orders.id, t.orderId) });
    if (order && !(order.paymentStatus === "paid" && status === "failed")) {
      await tx.update(orders).set({ paymentStatus: status, updatedAt: new Date() }).where(eq(orders.id, t.orderId));
    }
    logger.info("payment.status_applied", { provider, providerRef, from: current, to: status, orderId: t.orderId });
    return { changed: true, orderId: t.orderId, status };
  });
}

/** Returns false if this webhook event id was already processed. */
export async function claimWebhookEvent(database: Db, provider: PaymentMethod, eventId: string): Promise<boolean> {
  const r = await database
    .insert(webhookEvents)
    .values({ id: `${provider}:${eventId}` })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  return r.length > 0;
}

export async function latestPaymentForOrder(database: Db, orderId: string) {
  return (
    (await database.query.paymentTransactions.findFirst({
      where: eq(paymentTransactions.orderId, orderId),
      orderBy: desc(paymentTransactions.createdAt),
    })) ?? null
  );
}

/** Pull the authoritative status from the provider and apply it (used by callbacks and the "I paid" button). */
export async function syncPaymentFromProvider(database: Db, provider: PaymentProvider, providerRef: string) {
  if (!provider.fetchStatus) throw new AppError("UNAVAILABLE");
  const { status, raw } = await provider.fetchStatus(providerRef);
  return applyPaymentStatus(database, provider.id, providerRef, status, raw);
}

/** Payment attempts of one order of the caller's store (newest first) for the seller's order page. */
export async function listPaymentAttempts(database: Db, storeId: string, orderId: string) {
  return database.query.paymentTransactions.findMany({
    where: and(eq(paymentTransactions.orderId, orderId), eq(paymentTransactions.storeId, storeId)),
    orderBy: desc(paymentTransactions.createdAt),
    limit: 10,
  });
}
