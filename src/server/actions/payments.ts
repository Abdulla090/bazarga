"use server";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { orders, paymentTransactions } from "../db/schema";
import { requireStore } from "../auth/session";
import { enforceRateLimit } from "../auth/rate-limit";
import { AppError } from "../errors";
import { getProvider } from "../payments/registry";
import { syncPaymentFromProvider } from "../payments/service";
import { toActionState, type ActionState } from "./util";

/**
 * Seller's "Check payment now" on an online order: asks the provider for the latest attempt's authoritative status
 * (same idempotent path as webhooks and the reconciliation job). Store id from the session only.
 */
export async function checkOrderPaymentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { store } = await requireStore();
    const orderId = z.uuid().parse(fd.get("orderId"));
    await enforceRateLimit(db(), `paycheck-seller:${store.id}`, 30, 600);
    const order = await db().query.orders.findFirst({ where: and(eq(orders.id, orderId), eq(orders.storeId, store.id)), columns: { id: true } });
    if (!order) throw new AppError("NOT_FOUND");
    const tx = await db().query.paymentTransactions.findFirst({
      where: and(eq(paymentTransactions.orderId, order.id), eq(paymentTransactions.storeId, store.id)),
      orderBy: desc(paymentTransactions.createdAt),
    });
    if (!tx) throw new AppError("NOT_FOUND");
    const provider = getProvider(tx.provider);
    if (!provider.isConfigured() || !provider.fetchStatus) throw new AppError("UNAVAILABLE", "payment_check_unavailable");
    await syncPaymentFromProvider(db(), provider, tx.providerRef);
    revalidatePath(`/dashboard/orders/${order.id}`);
    revalidatePath("/dashboard/orders");
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}
