"use server";
import { after } from "next/server";
import { z } from "zod";
import { db } from "../db";
import { env } from "../env";
import { AppError } from "../errors";
import { logger } from "../logger";
import { enforceRateLimit } from "../auth/rate-limit";
import { clientIp } from "../auth/session";
import { getStoreBySlug } from "../services/stores";
import { getStorefrontStore } from "../cache/storefront";
import { invalidateStock } from "../cache/tags";
import { getOrderByPublicId, placeOrder, quoteCart, type Quote } from "../services/orders";
import { notifySellerOfOrder } from "../services/notify-order";
import { getProvider, isProviderAvailable } from "../payments/registry";
import { latestPaymentForOrder, startPayment, syncPaymentFromProvider } from "../payments/service";
import { cartSchema, checkoutSchema, localeSchema } from "@/lib/validation";
import { toActionState, type ActionState } from "./util";

const slugSchema = z.string().regex(/^[a-z0-9-]{2,40}$/);

/** Full store row, read fresh (checkout and payments must not act on a cached store). */
async function storeOr404(slug: string) {
  const store = await getStoreBySlug(db(), slugSchema.parse(slug));
  if (!store) throw new AppError("NOT_FOUND");
  return store;
}

/** Cached store lookup for read-only actions (cart quote). */
async function cachedStoreOr404(slug: string) {
  const store = await getStorefrontStore(slugSchema.parse(slug));
  if (!store) throw new AppError("NOT_FOUND");
  return store;
}

/** Server-side cart pricing (the cart in localStorage only holds product ids + quantities). */
export async function quoteAction(slug: string, items: unknown, cityKey: string | null, locale: string): Promise<Quote | null> {
  try {
    const store = await cachedStoreOr404(slug);
    const parsed = z.array(z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(99) })).max(50).parse(items);
    return await quoteCart(db(), store.id, parsed, cityKey ? z.string().max(40).parse(cityKey) : null, localeSchema.parse(locale));
  } catch {
    return null;
  }
}

function paymentUrls(slug: string, publicId: string) {
  const app = env().APP_URL.replace(/\/$/, "");
  return {
    orderUrl: `${app}/s/${slug}/order/${publicId}`,
    fibCallback: `${app}/api/payments/fib/callback`,
    zaincashReturn: `${app}/api/payments/zaincash/return?o=${encodeURIComponent(publicId)}`,
  };
}

export type PlaceOrderResult = ActionState & { redirectTo?: string; external?: boolean };

export async function placeOrderAction(slug: string, payload: unknown): Promise<PlaceOrderResult> {
  try {
    const store = await storeOr404(slug);
    const ip = await clientIp();
    await enforceRateLimit(db(), `checkout:${ip}`, 20, 600);
    const input = checkoutSchema.parse(payload);
    cartSchema.parse(input.items);
    const order = await placeOrder(db(), store, input, { isProviderAvailable });
    // Stock went down: product pages and the grid's sold-out / "only N left" badges must not be served stale.
    invalidateStock(store.id, order.items.map((i) => i.productId));
    logger.info("order.created", { storeId: store.id, orderId: order.id, total: order.total, method: order.paymentMethod });
    const appUrl = env().APP_URL;
    after(() => notifySellerOfOrder(db(), store, order, appUrl));

    const urls = paymentUrls(store.slug, order.publicId);
    if (order.paymentMethod === "cod") return { ok: true, redirectTo: urls.orderUrl };
    try {
      const init = await startPayment(db(), getProvider(order.paymentMethod), order, {
        storeName: store.name,
        returnUrl: order.paymentMethod === "zaincash" ? urls.zaincashReturn : urls.orderUrl,
        callbackUrl: urls.fibCallback,
      });
      if (init.kind === "redirect") return { ok: true, redirectTo: init.url, external: true };
    } catch (err) {
      // The order stands; the confirmation page offers a retry or paying the seller another way.
      logger.error("payment.start_failed", { orderId: order.id, err });
    }
    return { ok: true, redirectTo: urls.orderUrl };
  } catch (e) {
    return toActionState(e);
  }
}

export async function refreshPaymentAction(slug: string, publicId: string): Promise<ActionState> {
  try {
    const store = await storeOr404(slug);
    await enforceRateLimit(db(), `paycheck:${publicId}`, 30, 600);
    const order = await getOrderByPublicId(db(), store.id, z.string().max(64).parse(publicId));
    if (!order) throw new AppError("NOT_FOUND");
    const tx = await latestPaymentForOrder(db(), order.id);
    if (tx) await syncPaymentFromProvider(db(), getProvider(tx.provider), tx.providerRef);
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

export async function retryPaymentAction(slug: string, publicId: string): Promise<PlaceOrderResult> {
  try {
    const store = await storeOr404(slug);
    await enforceRateLimit(db(), `payretry:${publicId}`, 10, 600);
    const order = await getOrderByPublicId(db(), store.id, z.string().max(64).parse(publicId));
    if (!order || order.paymentMethod === "cod" || order.paymentStatus === "paid") throw new AppError("NOT_FOUND");
    if (order.status === "cancelled") throw new AppError("VALIDATION");
    const urls = paymentUrls(store.slug, order.publicId);
    const init = await startPayment(db(), getProvider(order.paymentMethod), order, {
      storeName: store.name,
      returnUrl: order.paymentMethod === "zaincash" ? urls.zaincashReturn : urls.orderUrl,
      callbackUrl: urls.fibCallback,
    });
    if (init.kind === "redirect") return { ok: true, redirectTo: init.url, external: true };
    return { ok: true, redirectTo: urls.orderUrl };
  } catch (e) {
    return toActionState(e);
  }
}
