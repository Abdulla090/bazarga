import { connection } from "next/server";
import { db } from "@/server/db";
import { enforceRateLimit } from "@/server/auth/rate-limit";
import { jsonError } from "@/server/http";
import { sessionStore } from "@/server/share/session";
import { listProductsForExport } from "@/server/services/catalog";
import { productsToCsv } from "@/lib/products-csv";
import { siteUrl } from "@/lib/seo";

/** Seller CSV export of the product catalogue. GET. Session-scoped (store from the cookie, never the URL). */
export async function GET() {
  await connection();
  try {
    const store = await sessionStore();
    await enforceRateLimit(db(), `products-export:${store.id}`, 30, 3600);
    const rows = await listProductsForExport(db(), store.id);
    const day = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
    return new Response(productsToCsv(rows, siteUrl()), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `attachment; filename="products-${store.slug}-${day}.csv"`,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
