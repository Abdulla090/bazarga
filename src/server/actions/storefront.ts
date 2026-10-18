"use server";
import { getMaintenance } from "../services/platform-settings";
import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
import { trackOrder } from "../services/tracking";
import { getProvider, isProviderAvailable } from "../payments/registry";
import { latestPaymentForOrder, startPayment, syncPaymentFromProvider } from "../payments/service";
import { startOrderCheckout, storeOnlineStatus, syncGatewayPayment } from "../payments/gateway/service";
import { gateway } from "../payments/gateway/registry";
import { payments as gatewayPayments } from "../db/schema";
import { and, desc, eq } from "drizzle-orm";
import { cartItemSchema, cartSchema, checkoutSchema, localeSchema } from "@/lib/validation";
import { toActionState, type ActionState } from "./util";
import { CHECKOUT_PER_IP_PER_STORE } from "@/lib/order-risk";
import { parseOrderNumber, trackingPath, TRACK_COOKIE, TRACK_COOKIE_TTL_SECONDS } from "@/lib/order-tracking";

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
const quoteExtraSchema = z
  .object({ areaId: z.uuid().nullish(), discountCode: z.string().trim().max(40).nullish() })
  .default({});

export async function quoteAction(slug: string, items: unknown, cityKey: string | null, locale: string, extra?: unknown): Promise<Quote | null> {
  try {
    const store = await cachedStoreOr404(slug);
    const parsed = z.array(cartItemSchema).max(50).parse(items);
    const opts = quoteExtraSchema.parse(extra ?? {});
    const ip = await clientIp();
    // Cart quotes are DB reads on every cart change; a generous per-IP cap stops scripted hammering without touching real shoppers.
    if (ip !== "unknown") await enforceRateLimit(db(), `quote:${ip}`, 300, 600);
    if (opts.discountCode) await enforceRateLimit(db(), `discount:${ip}`, 60, 600);
    return await quoteCart(db(), store.id, parsed, cityKey ? z.string().max(40).parse(cityKey) : null, localeSchema.parse(locale), opts);
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
    // Admin controls (docs/ADMIN.md): no orders into a suspended / unpublished store or while the platform is in maintenance.
    if (store.suspendedAt || !store.isActive || (await getMaintenance(db())).on) throw new AppError("UNAVAILABLE");
    const ip = await clientIp();
    await enforceRateLimit(db(), `checkout:${ip}`, 20, 600);
    // Per store too, so one IP can't flood a single seller with fake COD orders (src/lib/order-risk.ts). Skipped when
    // no proxy reports the client IP: every shopper would share "unknown" and a busy store would lock itself out.
    if (ip !== "unknown") await enforceRateLimit(db(), `checkout:${store.id}:${ip}`, CHECKOUT_PER_IP_PER_STORE.limit, CHECKOUT_PER_IP_PER_STORE.windowSeconds);
    const input = checkoutSchema.parse(payload);
    cartSchema.parse(input.items);
    // `online` (platform gateway) is only accepted when the gateway is on, payouts are verified and the seller enabled it.
    const online = input.paymentMethod === "online" ? (await storeOnlineStatus(db(), store.id)).available : false;
    const order = await placeOrder(db(), store, input, { isProviderAvailable: (m) => (m === "online" ? online : isProviderAvailable(m)) });
    if (order.replayed) {
      // Double tap: the first order already decremented stock and notified the seller.
      logger.info("order.replayed", { storeId: store.id, orderId: order.id });
    } else {
      // Stock went down: product pages and the grid's sold-out / "only N left" badges must not be served stale.
      invalidateStock(store.id, order.items.map((i) => i.productId));
      logger.info("order.created", { storeId: store.id, orderId: order.id, total: order.total, method: order.paymentMethod, risk: order.riskFlags });
      const appUrl = env().APP_URL;
      after(() => notifySellerOfOrder(db(), store, order, appUrl));
    }

    const urls = paymentUrls(store.slug, order.publicId);
    if (order.paymentMethod === "cod") return { ok: true, redirectTo: urls.orderUrl };
    if (order.paymentMethod === "online") {
      try {
        const c = await startOrderCheckout(db(), store.id, order.id, env().APP_URL, { storeName: store.name });
        return { ok: true, redirectTo: c.url, external: true };
      } catch (err) {
        logger.error("gateway.order_checkout_failed", { orderId: order.id, err });
        return { ok: true, redirectTo: urls.orderUrl };
      }
    }
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
    if (order.paymentMethod === "online") {
      const p = await db().query.payments.findFirst({
        where: and(eq(gatewayPayments.orderId, order.id), eq(gatewayPayments.storeId, store.id)),
        orderBy: desc(gatewayPayments.createdAt),
      });
      if (p && gateway()) await syncGatewayPayment(db(), p.id, "shopper_check");
      return { ok: true };
    }
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
    if (order.paymentMethod === "online") {
      const c = await startOrderCheckout(db(), store.id, order.id, env().APP_URL, { storeName: store.name });
      return { ok: true, redirectTo: c.url, external: true };
    }
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

/**
 * Order-tracking form (/s/[slug]/track). A plain <form action> so it works before hydration / without JS:
 * on a match the order's unguessable public id goes into a short-lived httpOnly cookie and the page re-renders it
 * (POST → redirect → GET, the phone never lands in a URL); every miss redirects with the same generic error.
 */
export async function trackOrderAction(formData: FormData): Promise<void> {
  const slugRaw = formData.get("slug");
  const parsedSlug = slugSchema.safeParse(slugRaw);
  if (!parsedSlug.success) redirect("/");
  const slug = parsedSlug.data;
  const numberRaw = formData.get("number");
  const n = parseOrderNumber(typeof numberRaw === "string" ? numberRaw.slice(0, 20) : null);
  const back = (e: "nf" | "rl") => `${trackingPath(slug, n ?? undefined)}${n ? "&" : "?"}e=${e}`;
  const store = await getStorefrontStore(slug);
  if (!store) redirect(back("nf"));
  const result = await trackOrder(db(), {
    storeId: store.id,
    ip: await clientIp(),
    number: typeof numberRaw === "string" ? numberRaw.slice(0, 20) : null,
    phone: formData.get("phone"),
  });
  if (!result.ok) {
    logger.info("order.track_miss", { storeId: store.id, reason: result.reason });
    redirect(back(result.reason === "rate_limited" ? "rl" : "nf"));
  }
  (await cookies()).set(TRACK_COOKIE, result.order.publicId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    maxAge: TRACK_COOKIE_TTL_SECONDS,
  });
  redirect(trackingPath(slug));
}
