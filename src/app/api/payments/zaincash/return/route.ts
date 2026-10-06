import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { orders, stores } from "@/server/db/schema";
import { env } from "@/server/env";
import { logger } from "@/server/logger";
import { providers } from "@/server/payments/registry";
import { syncPaymentFromProvider } from "@/server/payments/service";
import { zainCashClaims } from "@/server/payments/zaincash";

/**
 * Customer returns from ZainCash: GET ?o=<order publicId>&r=success|failure&token=<JWT>.
 * Verify the HS256 token, then confirm via the Inquiry API before updating, then send the
 * customer to their order page.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const publicId = url.searchParams.get("o") ?? "";
  const token = url.searchParams.get("token") ?? "";
  const app = env().APP_URL.replace(/\/$/, "");

  const order = /^[A-Za-z0-9_-]{8,64}$/.test(publicId)
    ? await db().query.orders.findFirst({ where: eq(orders.publicId, publicId) })
    : undefined;
  if (!order) return NextResponse.redirect(`${app}/`, 303);
  const store = await db().query.stores.findFirst({ where: eq(stores.id, order.storeId), columns: { slug: true } });
  const dest = `${app}/s/${store?.slug ?? ""}/order/${order.publicId}`;

  const zc = providers().zaincash;
  if (token && zc.isConfigured()) {
    try {
      const claims = zainCashClaims(await zc.verifyCallbackToken(token));
      if (claims.transactionId) await syncPaymentFromProvider(db(), zc, claims.transactionId);
    } catch (err) {
      logger.warn("zaincash.return_verify_failed", { orderId: order.id, err });
    }
  }
  return NextResponse.redirect(dest, 303);
}
