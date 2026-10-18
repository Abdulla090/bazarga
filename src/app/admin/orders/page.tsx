import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { listAllOrders } from "@/server/admin/service";
import { ModerationView } from "@/components/admin/ModerationView";
import { PageHeader } from "@/components/admin/kit";
import { ORDER_STATUSES, ORDER_TRANSITIONS, isOrderStatus } from "@/lib/order-status";

export const metadata = { title: "Admin · Orders", robots: { index: false } };

export default async function AdminOrders({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const t = await getTranslations("admin");
  const status = isOrderStatus(sp.status) ? sp.status : "all";
  const orders = await listAllOrders(db(), { q: sp.q, status, page: Number(sp.page ?? 1) });
  return (
    <div>
      <PageHeader title={t("nav.orders")} count={orders.total} sub={t("cat.ordersSub")} />
      <ModerationView
        tab="orders"
        q={sp.q ?? ""}
        state="all"
        status={status}
        statuses={[...ORDER_STATUSES]}
        transitions={ORDER_TRANSITIONS as Record<string, readonly string[]>}
        products={null}
        orders={{ ...orders, rows: orders.rows.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })) }}
      />
    </div>
  );
}
