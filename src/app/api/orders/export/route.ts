import { connection } from "next/server";
import { db } from "@/server/db";
import { enforceRateLimit } from "@/server/auth/rate-limit";
import { jsonError } from "@/server/http";
import { sessionStore } from "@/server/share/session";
import { listOrdersForExport } from "@/server/services/orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-status";
import { ordersToCsv } from "@/lib/orders-csv";

/** Seller CSV export of orders. GET [?status=]. Session-scoped (store from the cookie, never the URL). */
export async function GET(req: Request) {
  await connection();
  try {
    const store = await sessionStore();
    await enforceRateLimit(db(), `orders-export:${store.id}`, 30, 3600);
    const raw = new URL(req.url).searchParams.get("status") ?? "";
    const status = (ORDER_STATUSES as readonly string[]).includes(raw) ? (raw as OrderStatus) : undefined;
    const rows = await listOrdersForExport(db(), store.id, { status });
    const day = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
    return new Response(ordersToCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `attachment; filename="orders-${store.slug}${status ? `-${status}` : ""}-${day}.csv"`,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
