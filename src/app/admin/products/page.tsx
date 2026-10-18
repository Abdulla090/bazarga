import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { listAllProducts } from "@/server/admin/service";
import { ModerationView } from "@/components/admin/ModerationView";
import { PageHeader } from "@/components/admin/kit";
import { ORDER_STATUSES, ORDER_TRANSITIONS } from "@/lib/order-status";

export const metadata = { title: "Admin · Products", robots: { index: false } };

const nameOf = (n: unknown) => { const o = (n ?? {}) as Record<string, string>; return o.en || o.ku || o.ar || o.kmr || Object.values(o)[0] || "—"; };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const t = await getTranslations("admin");
  const state = sp.state === "hidden" || sp.state === "visible" ? sp.state : "all";
  const products = await listAllProducts(db(), { q: sp.q, state, page: Number(sp.page ?? 1) });
  return (
    <div>
      <PageHeader title={t("nav.products")} count={products.total} sub={t("cat.productsSub")} />
      <ModerationView
        tab="products"
        q={sp.q ?? ""}
        state={state}
        status="all"
        statuses={[...ORDER_STATUSES]}
        transitions={ORDER_TRANSITIONS as Record<string, readonly string[]>}
        products={{ ...products, rows: products.rows.map((p) => ({ id: p.id, name: nameOf(p.name), price: p.price, stock: p.stock, isActive: p.isActive, hidden: !!p.hiddenByAdminAt, shortCode: p.shortCode, storeId: p.storeId, storeName: p.storeName, storeSlug: p.storeSlug, createdAt: p.createdAt.toISOString() })) }}
        orders={null}
      />
    </div>
  );
}
