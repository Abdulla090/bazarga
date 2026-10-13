import "server-only";
import { z } from "zod";
import type { Db } from "../../db";
import { AppError } from "../../errors";
import { enforceRateLimit } from "../../auth/rate-limit";
import { getOrderByPublicId } from "../../services/orders";
import { getStoreBySlug, type Store } from "../../services/stores";
import { startOrderCheckout, startSubscriptionCheckout } from "./service";
import type { GatewayProvider } from "./types";

export const checkoutBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("subscription"), plan: z.enum(["pro", "business"]), months: z.union([z.literal(1), z.literal(12)]) }),
  z.object({ kind: z.literal("order"), slug: z.string().regex(/^[a-z0-9-]{2,40}$/), publicId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/) }),
]);

/**
 * POST /api/payments/checkout core (route-agnostic so tests can drive it):
 *  - subscription: the caller's own store only (`sessionStore` resolves it from the cookie; never from the body);
 *  - order: public (shopper), the order must belong to the store named by slug; rate limited per IP.
 */
export async function checkoutCore(
  database: Db,
  provider: GatewayProvider | null,
  raw: unknown,
  ctx: { ip: string; appUrl: string; sessionStore: () => Promise<Store> },
) {
  if (!provider) throw new AppError("NOT_FOUND", "payments_disabled");
  const body = checkoutBody.parse(raw);
  if (body.kind === "subscription") {
    const store = await ctx.sessionStore();
    await enforceRateLimit(database, `paysub:${store.id}`, 10, 600);
    return startSubscriptionCheckout(database, store.id, body, ctx.appUrl, provider);
  }
  await enforceRateLimit(database, `payorder:${ctx.ip}`, 20, 600);
  const store = await getStoreBySlug(database, body.slug);
  if (!store) throw new AppError("NOT_FOUND");
  const order = await getOrderByPublicId(database, store.id, body.publicId);
  if (!order) throw new AppError("NOT_FOUND");
  return startOrderCheckout(database, store.id, order.id, ctx.appUrl, { storeName: store.name, provider });
}
