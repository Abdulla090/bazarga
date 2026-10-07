import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { users } from "../db/schema";
import { notify } from "../notifications";
import { logger } from "../logger";
import { pushConfig, sendToStoreSellers, webPushSender, type PushSender } from "../push";
import { formatIQD } from "@/lib/money";
import { PAYMENT_LABEL } from "@/lib/order-status";
import { fullAddress } from "@/lib/whatsapp";
import type { PlacedOrder } from "./orders";
import type { Store } from "./stores";

/** Tell the seller about a new order on every configured channel (+ web push when VAPID is set). Never throws. */
export async function notifySellerOfOrder(database: Db, store: Store, order: PlacedOrder, appUrl: string) {
  await Promise.allSettled([notifyChannels(database, store, order, appUrl), pushNewOrder(database, store, order)]);
}

/** Web push to the store's seller devices. `sender` is injectable for tests; defaults to web-push with env VAPID. */
export async function pushNewOrder(database: Db, store: Store, order: PlacedOrder, sender?: PushSender) {
  try {
    let send = sender;
    if (!send) {
      const cfg = pushConfig();
      if (!cfg) return;
      send = await webPushSender(cfg);
    }
    await sendToStoreSellers(
      database,
      store.id,
      {
        title: `🛍️ داواکاری نوێ #${order.number}`,
        body: `${order.customerName} · ${order.cityName} · ${formatIQD(order.total, "ku")}`,
        url: `/dashboard/orders/${order.id}`,
        tag: `order-${order.id}`,
        dir: "rtl",
        lang: "ckb",
      },
      send,
    );
  } catch (err) {
    logger.error("push.new_order_failed", { err });
  }
}

async function notifyChannels(database: Db, store: Store, order: PlacedOrder, appUrl: string) {
  const owner = await database.query.users.findFirst({ where: eq(users.id, store.ownerId), columns: { email: true } });
  const lines = order.items.map((i) => `• ${i.name}${i.variantTitle ? ` (${i.variantTitle})` : ""} ×${i.quantity}`).join("\n");
  await notify({
    kind: "order.created",
    to: { whatsapp: store.whatsapp, email: owner?.email ?? null },
    title: `🛍️ داواکاری نوێ #${order.number} — ${store.name}`,
    body: `${order.customerName} · ${order.customerPhone}\n${order.cityName}, ${fullAddress(order)}\n${lines}\n${formatIQD(order.total, "ku")} · ${PAYMENT_LABEL[order.paymentMethod]}`,
    link: `${appUrl}/dashboard/orders/${order.id}`,
  });
}
