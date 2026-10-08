import { after, connection } from "next/server";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { clientIp } from "@/server/auth/session";
import { getCatalog, getStorefrontStore } from "@/server/cache/storefront";
import { firstSeen } from "@/server/analytics/dedupe";
import { recordView } from "@/server/services/analytics";
import { CHECKOUT_PAGE, HOME_PAGE, iraqDay, isBot, isPrefetch, PRODUCT_VISITORS_PAGE, VISITORS_PAGE, WHATSAPP_PAGE } from "@/lib/analytics";

/** 1×1 transparent GIF (43 bytes). */
const GIF = Uint8Array.from(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
const SLUG_RE = /^[a-z0-9-]{2,40}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function pixel() {
  return new Response(GIF, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}

/**
 * View pixel for seller analytics: GET /api/v/<slug>[?p=<productId> | ?c=1 | ?w=1], rendered as an <img> by the store home,
 * product pages and (when the cart has items) the checkout page (src/components/store/ViewPixel.tsx); `?w=1` is the WhatsApp-tap beacon fired by WaTap. Always answers the same GIF; the count happens after the
 * response. Bots, prefetches, unknown stores and products that aren't in the store's catalog are ignored, and a
 * visitor counts once per page per day (src/server/analytics/dedupe.ts). See src/lib/analytics.ts.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const q = new URL(req.url).searchParams;
  const p = q.get("p");
  const checkout = q.get("c") === "1";
  const whatsapp = q.get("w") === "1";
  const h = req.headers;
  if (!SLUG_RE.test(slug) || (p !== null && !UUID_RE.test(p)) || (checkout && p !== null) || (whatsapp && (p !== null || checkout)) || isBot(h.get("user-agent")) || isPrefetch(h)) return pixel();
  const ip = await clientIp();
  const ua = h.get("user-agent") ?? "";
  after(async () => {
    try {
      const store = await getStorefrontStore(slug);
      if (!store) return;
      if (p && !(await getCatalog(store.id)).products.some((x) => x.id === p)) return;
      const page = p ?? (checkout ? CHECKOUT_PAGE : whatsapp ? WHATSAPP_PAGE : HOME_PAGE);
      const today = iraqDay(new Date());
      if (!firstSeen(today, [ip, ua, store.id, page])) return;
      const newVisitor = whatsapp ? false : firstSeen(today, [ip, ua, store.id, VISITORS_PAGE]);
      const productVisitor = p ? firstSeen(today, [ip, ua, store.id, PRODUCT_VISITORS_PAGE]) : false;
      await recordView(db(), store.id, page, { newVisitor, productVisitor });
    } catch (err) {
      logger.warn("analytics.view_failed", { err });
    }
  });
  return pixel();
}
