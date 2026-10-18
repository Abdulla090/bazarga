import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { listAllOrders, listAllProducts } from "@/server/admin/service";
import { ModerationView } from "@/components/admin/ModerationView";
import { ORDER_STATUSES, ORDER_TRANSITIONS, isOrderStatus } from "@/lib/order-status";

export const metadata = { title: "Admin · Moderation", robots: { index: false } };

export default async function AdminCatalog({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const t = await getTranslations("admin");
  const tab = sp.tab === "orders" ? "orders" : "products";
  const page = Number(sp.page ?? 1);
  const name = (n: unknown) => { const o = (n ?? {}) as Record<string, string>; return o.en || o.ku || o.ar || o.kmr || Object.values(o)[0] || "—"; };
  const products = tab === "products" ? await listAllProducts(db(), { q: sp.q, state: sp.state === "hidden" || sp.state === "visible" ? sp.state : "all", page }) : null;
  const orders = tab === "orders" ? await listAllOrders(db(), { q: sp.q, status: isOrderStatus(sp.status) ? sp.status : "all", page }) : null;
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight md:text-3xl">{t("cat.title")}</h1>
      <ModerationView
        tab={tab}
        q={sp.q ?? ""}
        state={sp.state ?? "all"}
        status={sp.status ?? "all"}
        statuses={[...ORDER_STATUSES]}
        transitions={ORDER_TRANSITIONS as Record<string, readonly string[]>}
        products={products && { ...products, rows: products.rows.map((p) => ({ id: p.id, name: name(p.name), price: p.price, stock: p.stock, isActive: p.isActive, hidden: !!p.hiddenByAdminAt, shortCode: p.shortCode, storeId: p.storeId, storeName: p.storeName, storeSlug: p.storeSlug, createdAt: p.createdAt.toISOString() })) }}
        orders={orders && { ...orders, rows: orders.rows.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })) }}
      />
    </div>
  );
}
