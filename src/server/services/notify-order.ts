import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { users } from "../db/schema";
import { notify } from "../notifications";
import { formatIQD } from "@/lib/money";
import { PAYMENT_LABEL } from "@/lib/order-status";
import type { PlacedOrder } from "./orders";
import type { Store } from "./stores";

/** Tell the seller about a new order on every configured channel. Never throws. */
export async function notifySellerOfOrder(database: Db, store: Store, order: PlacedOrder, appUrl: string) {
  const owner = await database.query.users.findFirst({ where: eq(users.id, store.ownerId), columns: { email: true } });
  const lines = order.items.map((i) => `• ${i.name}${i.variantTitle ? ` (${i.variantTitle})` : ""} ×${i.quantity}`).join("\n");
  await notify({
    kind: "order.created",
    to: { whatsapp: store.whatsapp, email: owner?.email ?? null },
    title: `🛍️ داواکاری نوێ #${order.number} — ${store.name}`,
    body: `${order.customerName} · ${order.customerPhone}\n${order.cityName}, ${order.address}\n${lines}\n${formatIQD(order.total, "ku")} · ${PAYMENT_LABEL[order.paymentMethod]}`,
    link: `${appUrl}/dashboard/orders/${order.id}`,
  });
}
