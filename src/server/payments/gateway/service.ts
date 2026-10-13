import "server-only";
import { and, asc, desc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../../db";
import {
  ledgerEntries,
  orders,
  paymentEvents,
  payments,
  payouts,
  sellerPayoutProfiles,
  storePaymentMethods,
  storePlanHistory,
  upgradeRequests,
} from "../../db/schema";
import { AppError } from "../../errors";
import { logger } from "../../logger";
import { activateRequestTx, createUpgradeRequest } from "../../services/upgrades";
import { gatewayConfig } from "./config";
import { commissionIqd, subscriptionPrice } from "./pricing";
import { gateway } from "./registry";
import { canMove } from "./state";
import type { GatewayProvider, GatewayStatus, ProviderStatus, WebhookRequest } from "./types";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type PaymentRow = typeof payments.$inferSelect;

/** The active provider or a 404-shaped error: with PAYMENTS_PROVIDER=none every gateway entry point is "not there". */
export function requireGateway(p: GatewayProvider | null = gateway()): GatewayProvider {
  if (!p) throw new AppError("NOT_FOUND", "payments_disabled");
  return p;
}

function urls(appUrl: string, provider: GatewayProvider, paymentId: string) {
  const app = appUrl.replace(/\/$/, "");
  const c = gatewayConfig();
  const secret = c.provider === "none" ? "" : c.webhookSecret;
  return {
    redirectUrl: `${app}/payments/return?p=${paymentId}`,
    callbackUrl: `${app}/api/payments/webhook/${provider.id}?token=${encodeURIComponent(secret)}`,
  };
}

async function openCheckout(database: Db, provider: GatewayProvider, row: PaymentRow, appUrl: string, input: { title: string; description: string; feeFromCustomer: boolean; phone: boolean }) {
  const c = gatewayConfig();
  const gateways = c.provider === "none" ? [] : c.gateways;
  try {
    const res = await provider.createCheckout({
      paymentId: row.id,
      amountIqd: row.amountIqd,
      title: input.title,
      description: input.description,
      gateways,
      ...urls(appUrl, provider, row.id),
      collectFeeFromCustomer: input.feeFromCustomer,
      collectCustomerPhoneNumber: input.phone,
    });
    await database
      .update(payments)
      .set({ providerRef: res.providerRef, checkoutUrl: res.checkoutUrl, raw: { create: res.raw }, updatedAt: new Date() })
      .where(eq(payments.id, row.id));
    logger.info("gateway.checkout_created", { paymentId: row.id, kind: row.kind, storeId: row.storeId, amount: row.amountIqd });
    return { paymentId: row.id, url: res.checkoutUrl };
  } catch (err) {
    await database.update(payments).set({ status: "failed", updatedAt: new Date(), raw: { createError: String((err as Error).message ?? err) } }).where(eq(payments.id, row.id));
    logger.error("gateway.checkout_failed", { paymentId: row.id, kind: row.kind, err });
    throw err instanceof AppError ? err : new AppError("PAYMENT_ERROR", "checkout_failed");
  }
}

// ---------------------------------------------------------------- (a) subscriptions
export const subscriptionCheckoutInput = z.object({
  plan: z.enum(["pro", "business"]),
  months: z.coerce.number().pipe(z.union([z.literal(1), z.literal(12)])),
});

/** A store qualifies for the Pro first-month promo once: never had a paid plan before. */
export async function firstMonthEligible(database: Db, storeId: string): Promise<boolean> {
  const h = await database
    .select({ id: storePlanHistory.id })
    .from(storePlanHistory)
    .where(and(eq(storePlanHistory.storeId, storeId), inArray(storePlanHistory.toPlan, ["pro", "business"])))
    .limit(1);
  return h.length === 0;
}

export async function quoteSubscription(database: Db, storeId: string, plan: "pro" | "business", months: 1 | 12) {
  const c = gatewayConfig();
  return subscriptionPrice(plan, months, c.usdIqdRate, await firstMonthEligible(database, storeId));
}

/**
 * Seller clicks "Pay online": record an upgrade request (method online) + a pending payment, open a hosted checkout.
 * `storeId` always comes from the session (requireStore), never from the client.
 */
export async function startSubscriptionCheckout(database: Db, storeId: string, raw: unknown, appUrl: string, provider = gateway()) {
  const p = requireGateway(provider);
  const input = subscriptionCheckoutInput.parse(raw);
  const price = await quoteSubscription(database, storeId, input.plan, input.months);
  const req = await createUpgradeRequest(database, storeId, { plan: input.plan, months: input.months, method: "online" });
  const [row] = await database
    .insert(payments)
    .values({
      kind: "subscription",
      storeId,
      upgradeRequestId: req.id,
      provider: p.id,
      amountIqd: price.iqd,
      meta: { plan: input.plan, months: input.months, usd: price.usd, promo: price.promo, rate: gatewayConfig().usdIqdRate },
    })
    .returning();
  const label = `Bazarga ${input.plan === "pro" ? "Pro" : "Business"} · ${input.months === 12 ? "12 months" : "1 month"}`;
  return openCheckout(database, p, row!, appUrl, { title: label, description: label, feeFromCustomer: false, phone: false });
}

// ---------------------------------------------------------------- (b) storefront orders (marketplace: platform collects)
/** Online payments show on a storefront only when the gateway is on, payouts are verified and the seller turned it on. */
export async function storeOnlineStatus(database: Db, storeId: string, provider = gateway()) {
  const profile = (await database.query.sellerPayoutProfiles.findFirst({ where: eq(sellerPayoutProfiles.storeId, storeId) })) ?? null;
  const toggle = await database.query.storePaymentMethods.findFirst({
    where: and(eq(storePaymentMethods.storeId, storeId), eq(storePaymentMethods.method, "online")),
  });
  const gatewayOn = provider !== null;
  const verified = profile?.status === "verified";
  return { gatewayOn, profile, verified, enabled: !!toggle?.enabled, available: gatewayOn && verified && !!toggle?.enabled };
}

export async function setOnlinePayments(database: Db, storeId: string, enabled: boolean, provider = gateway()) {
  const s = await storeOnlineStatus(database, storeId, provider);
  if (enabled && !(s.gatewayOn && s.verified)) throw new AppError("VALIDATION", "online_payments_unavailable");
  await database
    .insert(storePaymentMethods)
    .values({ storeId, method: "online", enabled })
    .onConflictDoUpdate({ target: [storePaymentMethods.storeId, storePaymentMethods.method], set: { enabled, updatedAt: new Date() } });
}

/** Shopper pays an order online. Re-uses a still-open checkout for the same order instead of opening a second one. */
export async function startOrderCheckout(
  database: Db,
  storeId: string,
  orderId: string,
  appUrl: string,
  opts: { storeName: string; provider?: GatewayProvider | null; now?: Date } = { storeName: "" },
) {
  const p = requireGateway(opts.provider === undefined ? gateway() : opts.provider);
  const order = await database.query.orders.findFirst({ where: and(eq(orders.id, orderId), eq(orders.storeId, storeId)) });
  if (!order || order.paymentMethod !== "online") throw new AppError("NOT_FOUND");
  if (order.paymentStatus === "paid") throw new AppError("CONFLICT", "already_paid");
  if (order.status === "cancelled") throw new AppError("VALIDATION", "order_cancelled");
  const now = opts.now ?? new Date();
  const open = await database.query.payments.findFirst({
    where: and(eq(payments.orderId, order.id), eq(payments.storeId, storeId), eq(payments.status, "pending"), eq(payments.amountIqd, order.total)),
    orderBy: desc(payments.createdAt),
  });
  if (open?.checkoutUrl && now.getTime() - open.createdAt.getTime() < 60 * 60_000) return { paymentId: open.id, url: open.checkoutUrl };
  const c = gatewayConfig();
  const [row] = await database
    .insert(payments)
    .values({
      kind: "order",
      storeId,
      orderId: order.id,
      provider: p.id,
      amountIqd: order.total,
      commissionIqd: commissionIqd(order.total, c.commissionBps),
      meta: { orderNumber: order.number, publicId: order.publicId, commissionBps: c.commissionBps },
    })
    .returning();
  await database.update(orders).set({ paymentStatus: "pending", updatedAt: now }).where(and(eq(orders.id, order.id), eq(orders.paymentStatus, "unpaid")));
  const title = `${opts.storeName || "Bazarga"} #${order.number}`;
  return openCheckout(database, p, row!, appUrl, {
    title,
    description: title,
    feeFromCustomer: c.provider !== "none" && c.feeFromCustomer,
    phone: false,
  });
}

// ---------------------------------------------------------------- applying provider-confirmed status
/**
 * The ONLY place payment state changes. Runs in one transaction with the payment row locked, so a webhook, the
 * return page poll and the reconciliation cron can race safely; only forward transitions apply (state.ts).
 * paid → subscription: plan activated (plan history + expiry logic reused); order: order paid + ledger booked.
 */
export async function applyGatewayStatus(database: Db, paymentId: string, s: ProviderStatus, via: string, now: Date = new Date()) {
  return database.transaction(async (tx) => {
    const [row] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!row) throw new AppError("NOT_FOUND");
    const from = row.status as GatewayStatus;
    if (!canMove(from, s.status)) return { changed: false as const, payment: row };
    const [updated] = await tx
      .update(payments)
      .set({
        status: s.status,
        gateway: s.gateway ?? row.gateway,
        paidAt: s.status === "paid" ? (s.paidAt ? safeDate(s.paidAt) ?? now : now) : row.paidAt,
        raw: { ...row.raw, last: s.raw, via },
        updatedAt: now,
      })
      .where(eq(payments.id, row.id))
      .returning();
    if (s.status === "paid") await onPaid(tx, updated!, now);
    else if (row.kind === "order" && row.orderId && (s.status === "failed" || s.status === "expired")) {
      await tx
        .update(orders)
        .set({ paymentStatus: "failed", updatedAt: now })
        .where(and(eq(orders.id, row.orderId), eq(orders.storeId, row.storeId), sql`${orders.paymentStatus} <> 'paid'`));
    } else if (s.status === "refunded") await onRefunded(tx, updated!, now);
    logger.info("gateway.status_applied", { paymentId: row.id, kind: row.kind, from, to: s.status, via });
    return { changed: true as const, payment: updated! };
  });
}

async function onPaid(tx: Tx, row: PaymentRow, now: Date) {
  if (row.kind === "subscription") {
    let requestId = row.upgradeRequestId;
    const req = requestId ? await tx.query.upgradeRequests.findFirst({ where: eq(upgradeRequests.id, requestId) }) : null;
    if (!req || req.status !== "pending") {
      // The seller replaced/abandoned the request meanwhile (or an admin resolved it): the money arrived, so honour
      // exactly what was paid for with a fresh request — never drop a paid subscription.
      const meta = row.meta as { plan?: string; months?: number };
      if (req?.status === "activated" && req.id === row.upgradeRequestId) return;
      const [fresh] = await tx
        .insert(upgradeRequests)
        .values({ storeId: row.storeId, plan: meta.plan === "business" ? "business" : "pro", months: meta.months === 12 ? 12 : 1, method: "online", note: `payment ${row.id}` })
        .returning();
      requestId = fresh!.id;
      await tx.update(payments).set({ upgradeRequestId: requestId }).where(eq(payments.id, row.id));
    }
    await activateRequestTx(tx, requestId!, now, "upgrade:online");
    return;
  }
  if (!row.orderId) return;
  const order = await tx.query.orders.findFirst({ where: and(eq(orders.id, row.orderId), eq(orders.storeId, row.storeId)) });
  if (!order) return;
  await tx.update(orders).set({ paymentStatus: "paid", updatedAt: now }).where(and(eq(orders.id, order.id), eq(orders.storeId, row.storeId)));
  const entries = [
    { storeId: row.storeId, account: "seller" as const, entryType: "sale" as const, amountIqd: row.amountIqd, paymentId: row.id, memo: `order #${order.number}` },
    ...(row.commissionIqd > 0
      ? [
          { storeId: row.storeId, account: "seller" as const, entryType: "commission" as const, amountIqd: -row.commissionIqd, paymentId: row.id, memo: `order #${order.number}` },
          { storeId: row.storeId, account: "platform" as const, entryType: "commission_income" as const, amountIqd: row.commissionIqd, paymentId: row.id, memo: `order #${order.number}` },
        ]
      : []),
  ];
  await tx.insert(ledgerEntries).values(entries).onConflictDoNothing();
  if (order.status === "cancelled") logger.warn("gateway.paid_after_cancel", { paymentId: row.id, orderId: order.id, storeId: row.storeId });
}

async function onRefunded(tx: Tx, row: PaymentRow, now: Date) {
  if (row.kind !== "order") return;
  await tx
    .insert(ledgerEntries)
    .values({ storeId: row.storeId, account: "seller", entryType: "refund", amountIqd: -(row.amountIqd - row.commissionIqd), paymentId: row.id, memo: "refund", createdAt: now })
    .onConflictDoNothing();
  if (row.orderId) await tx.update(orders).set({ paymentStatus: "refunded", updatedAt: now }).where(and(eq(orders.id, row.orderId), eq(orders.storeId, row.storeId)));
}

function safeDate(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Ask the provider and apply (return-page poll, reconciliation). Never trusts anything the browser says. */
export async function syncGatewayPayment(database: Db, paymentId: string, via: string, provider = gateway()) {
  const p = requireGateway(provider);
  const row = await database.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!row) throw new AppError("NOT_FOUND");
  if (!row.providerRef || row.provider !== p.id) return { changed: false as const, payment: row };
  const s = await p.getStatus(row.providerRef);
  return applyGatewayStatus(database, row.id, s, via);
}

// ---------------------------------------------------------------- webhook
export type WebhookOutcome = { status: 200 | 401 | 404; body: Record<string, unknown> };

/**
 * Webhook: authenticate (401 otherwise), claim the event id (duplicates → 200, no work), then re-fetch the
 * authoritative status and apply it atomically. Always 200 once authenticated so Rasedi doesn't hammer us;
 * a failed lookup is left to the reconciliation cron (the event claim is released so a retry can redo it).
 */
export async function handleGatewayWebhook(database: Db, providerId: string, req: WebhookRequest, provider = gateway()): Promise<WebhookOutcome> {
  if (!provider || provider.id !== providerId) return { status: 404, body: { ok: false } };
  const v = provider.verifyWebhook(req);
  if (!v) {
    logger.warn("gateway.webhook_unauthenticated", { provider: providerId });
    return { status: 401, body: { ok: false } };
  }
  const row = await database.query.payments.findFirst({ where: and(eq(payments.provider, provider.id), eq(payments.providerRef, v.providerRef)) });
  const claimed = await database
    .insert(paymentEvents)
    .values({ provider: provider.id, eventId: v.eventId, providerRef: v.providerRef, paymentId: row?.id ?? null, status: v.reportedStatus, payload: v.payload })
    .onConflictDoNothing()
    .returning({ id: paymentEvents.id });
  if (!claimed.length) return { status: 200, body: { ok: true, duplicate: true } };
  const eventRowId = claimed[0]!.id;
  if (!row) {
    await database.update(paymentEvents).set({ outcome: "unknown_payment" }).where(eq(paymentEvents.id, eventRowId));
    logger.warn("gateway.webhook_unknown_payment", { provider: providerId });
    return { status: 200, body: { ok: true } };
  }
  try {
    const s = await provider.getStatus(v.providerRef);
    const r = await applyGatewayStatus(database, row.id, s, "webhook");
    await database.update(paymentEvents).set({ outcome: r.changed ? `applied:${s.status}` : `noop:${r.payment.status}` }).where(eq(paymentEvents.id, eventRowId));
    return { status: 200, body: { ok: true, changed: r.changed } };
  } catch (err) {
    logger.error("gateway.webhook_apply_failed", { paymentId: row.id, err });
    await database.delete(paymentEvents).where(eq(paymentEvents.id, eventRowId));
    return { status: 200, body: { ok: true, deferred: true } };
  }
}

// ---------------------------------------------------------------- reconciliation
export const GATEWAY_RECONCILE_AFTER_MS = 15 * 60_000;
export const GATEWAY_RECONCILE_EVERY_MS = 10 * 60_000;
export const GATEWAY_RECONCILE_MAX_CHECKS = 60;
export const GATEWAY_ORPHAN_AFTER_MS = 60 * 60_000;

export type GatewayReconcileResult = { checked: number; changed: number; errors: number; orphaned: number };

/** Pending payments older than 15 min: ask the provider (bounded, backed off, claim-before-check so runs can overlap). */
export async function reconcileGatewayPayments(database: Db, opts: { now?: Date; limit?: number; provider?: GatewayProvider | null } = {}): Promise<GatewayReconcileResult> {
  const res: GatewayReconcileResult = { checked: 0, changed: 0, errors: 0, orphaned: 0 };
  const p = opts.provider === undefined ? gateway() : opts.provider;
  if (!p) return res;
  const now = opts.now ?? new Date();
  // Checkout creation crashed before we got a reference: nothing to ask, close it.
  const orphans = await database
    .update(payments)
    .set({ status: "failed", updatedAt: now })
    .where(and(eq(payments.status, "pending"), isNull(payments.providerRef), lte(payments.createdAt, new Date(now.getTime() - GATEWAY_ORPHAN_AFTER_MS))))
    .returning({ id: payments.id });
  res.orphaned = orphans.length;
  const due = await database
    .select({ id: payments.id, checkCount: payments.checkCount })
    .from(payments)
    .where(
      and(
        eq(payments.status, "pending"),
        eq(payments.provider, p.id),
        sql`${payments.providerRef} IS NOT NULL`,
        lte(payments.createdAt, new Date(now.getTime() - GATEWAY_RECONCILE_AFTER_MS)),
        lt(payments.checkCount, GATEWAY_RECONCILE_MAX_CHECKS),
        or(isNull(payments.lastCheckedAt), lte(payments.lastCheckedAt, new Date(now.getTime() - GATEWAY_RECONCILE_EVERY_MS))),
      ),
    )
    .orderBy(asc(payments.createdAt))
    .limit(opts.limit ?? 50);
  for (const d of due) {
    const claimed = await database
      .update(payments)
      .set({ lastCheckedAt: now, checkCount: sql`${payments.checkCount} + 1` })
      .where(and(eq(payments.id, d.id), eq(payments.checkCount, d.checkCount)))
      .returning({ id: payments.id });
    if (!claimed.length) continue;
    res.checked++;
    try {
      const r = await syncGatewayPayment(database, d.id, "reconcile", p);
      if (r.changed) res.changed++;
    } catch (err) {
      res.errors++;
      logger.warn("gateway.reconcile_failed", { paymentId: d.id, err });
    }
  }
  if (res.checked || res.orphaned) logger.info("gateway.reconciled", res);
  return res;
}

// ---------------------------------------------------------------- payout profiles, balances, payouts
export const payoutProfileInput = z.object({
  method: z.enum(["fib", "zaincash", "bank"]),
  accountName: z.string().trim().min(2).max(80),
  accountIdentifier: z
    .string()
    .trim()
    .min(6)
    .max(40)
    .regex(/^[A-Za-z0-9 +-]+$/),
});

/** Seller saves payout details; any change goes back to `pending` (re-verification) and switches online payments off. */
export async function savePayoutProfile(database: Db, storeId: string, raw: unknown) {
  const input = payoutProfileInput.parse(raw);
  return database.transaction(async (tx) => {
    const existing = await tx.query.sellerPayoutProfiles.findFirst({ where: eq(sellerPayoutProfiles.storeId, storeId) });
    const same = existing && existing.method === input.method && existing.accountIdentifier === input.accountIdentifier && existing.accountName === input.accountName;
    if (same) return existing;
    const now = new Date();
    const [row] = await tx
      .insert(sellerPayoutProfiles)
      .values({ storeId, ...input, status: "pending", updatedAt: now })
      .onConflictDoUpdate({ target: sellerPayoutProfiles.storeId, set: { ...input, status: "pending", verifiedAt: null, note: null, updatedAt: now } })
      .returning();
    await tx
      .update(storePaymentMethods)
      .set({ enabled: false, updatedAt: now })
      .where(and(eq(storePaymentMethods.storeId, storeId), eq(storePaymentMethods.method, "online")));
    return row!;
  });
}

export async function getPayoutProfile(database: Db, storeId: string) {
  return (await database.query.sellerPayoutProfiles.findFirst({ where: eq(sellerPayoutProfiles.storeId, storeId) })) ?? null;
}

/** Admin only (caller enforces requireAdmin). */
export async function reviewPayoutProfile(database: Db, storeId: string, decision: "verified" | "rejected", note?: string) {
  const now = new Date();
  await database
    .update(sellerPayoutProfiles)
    .set({ status: decision, verifiedAt: decision === "verified" ? now : null, note: note ?? null, updatedAt: now })
    .where(eq(sellerPayoutProfiles.storeId, storeId));
  if (decision === "rejected") {
    await database.update(storePaymentMethods).set({ enabled: false, updatedAt: now }).where(and(eq(storePaymentMethods.storeId, storeId), eq(storePaymentMethods.method, "online")));
  }
}

export async function sellerBalance(database: Db, storeId: string): Promise<number> {
  const [r] = await database
    .select({ total: sql<string>`coalesce(sum(${ledgerEntries.amountIqd}), 0)` })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.storeId, storeId), eq(ledgerEntries.account, "seller")));
  return Number(r?.total ?? 0);
}

/** Admin: queue a payout of (up to) the store's available balance minus payouts already queued. */
export async function createPayout(database: Db, storeId: string, amountIqd?: number) {
  return database.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`payout:${storeId}`}))`);
    const profile = await tx.query.sellerPayoutProfiles.findFirst({ where: eq(sellerPayoutProfiles.storeId, storeId) });
    if (!profile || profile.status !== "verified") throw new AppError("VALIDATION", "payout_profile_unverified");
    const [bal] = await tx
      .select({ total: sql<string>`coalesce(sum(${ledgerEntries.amountIqd}), 0)` })
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.storeId, storeId), eq(ledgerEntries.account, "seller")));
    const [queued] = await tx
      .select({ total: sql<string>`coalesce(sum(${payouts.amountIqd}), 0)` })
      .from(payouts)
      .where(and(eq(payouts.storeId, storeId), eq(payouts.status, "pending")));
    const available = Number(bal?.total ?? 0) - Number(queued?.total ?? 0);
    const amount = amountIqd ?? available;
    if (!Number.isInteger(amount) || amount <= 0 || amount > available) throw new AppError("VALIDATION", "payout_amount_invalid");
    const [row] = await tx
      .insert(payouts)
      .values({ storeId, amountIqd: amount, method: profile.method, accountIdentifier: profile.accountIdentifier })
      .returning();
    return row!;
  });
}

/** Admin: the money left our account. Books the ledger debit exactly once. */
export async function markPayoutPaid(database: Db, payoutId: string, reference: string | null, now: Date = new Date()) {
  return database.transaction(async (tx) => {
    const [p] = await tx.select().from(payouts).where(eq(payouts.id, payoutId)).for("update");
    if (!p) throw new AppError("NOT_FOUND");
    if (p.status !== "pending") return { already: true as const };
    await tx.update(payouts).set({ status: "paid", paidAt: now, reference: reference?.slice(0, 120) ?? null }).where(eq(payouts.id, p.id));
    await tx.insert(ledgerEntries).values({ storeId: p.storeId, account: "seller", entryType: "payout", amountIqd: -p.amountIqd, payoutId: p.id, memo: reference?.slice(0, 120) ?? null });
    return { already: false as const };
  });
}

// ---------------------------------------------------------------- reads (tenant-scoped)
export async function listStorePayments(database: Db, storeId: string, limit = 20) {
  return database.query.payments.findMany({ where: eq(payments.storeId, storeId), orderBy: desc(payments.createdAt), limit });
}

export async function listStorePayouts(database: Db, storeId: string, limit = 20) {
  return database.query.payouts.findMany({ where: eq(payouts.storeId, storeId), orderBy: desc(payouts.createdAt), limit });
}

/** Admin-wide lists (caller enforces requireAdmin). */
export async function adminListPayments(database: Db, limit = 100) {
  return database.query.payments.findMany({ orderBy: desc(payments.createdAt), limit });
}
export async function adminListPayouts(database: Db, limit = 100) {
  return database.query.payouts.findMany({ orderBy: desc(payouts.createdAt), limit });
}
export async function adminListPayoutProfiles(database: Db) {
  return database.query.sellerPayoutProfiles.findMany({ orderBy: desc(sellerPayoutProfiles.updatedAt), limit: 200 });
}

/** Public, minimal view for the return page: no PII, only what the status screen needs. */
export async function publicPaymentView(database: Db, paymentId: string) {
  const row = await database.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!row) return null;
  let next: string | null = null;
  if (row.kind === "order" && row.orderId) {
    const o = await database.query.orders.findFirst({ where: and(eq(orders.id, row.orderId), eq(orders.storeId, row.storeId)) });
    const store = o ? await database.query.stores.findFirst({ where: (s, { eq: e }) => e(s.id, row.storeId), columns: { slug: true } }) : null;
    if (o && store) next = `/s/${store.slug}/order/${o.publicId}`;
  } else if (row.kind === "subscription") next = "/dashboard/upgrade";
  return { id: row.id, kind: row.kind, status: row.status as GatewayStatus, amountIqd: row.amountIqd, next, createdAt: row.createdAt };
}
