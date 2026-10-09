import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { listOrders } from "@/server/services/orders";
import { currentLocale } from "@/server/locale";
import { formatIQD } from "@/lib/money";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-status";
import { PaymentBadge, StatusBadge } from "@/components/dashboard/Badges";
import { knownRiskFlags } from "@/lib/order-risk";
import { Icon, TriangleAlert } from "@/components/ui/icons";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { store } = await requireStore();
  const t = await getTranslations("orders");
  const tr = await getTranslations("risk");
  const locale = await currentLocale();
  const { status: raw } = await searchParams;
  const status = (ORDER_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as OrderStatus) : undefined;
  const orders = await listOrders(db(), store.id, { status, limit: 200 });
  const fmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-IQ-u-nu-latn", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Baghdad" });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">{t("title")}</h1>
        <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/orders/courier" className="btn-ghost btn-sm" data-testid="orders-courier">{t("courier")}</Link>
        {orders.length > 0 && (
          <a href={status ? `/api/orders/export?status=${status}` : "/api/orders/export"} download className="btn-ghost btn-sm" data-testid="orders-export">
            {t("export")}
          </a>
        )}
        </div>
      </div>
      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1" aria-label={t("status")}>
        {[undefined, ...ORDER_STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/dashboard/orders?status=${s}` : "/dashboard/orders"}
            aria-current={status === s ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-3 py-1.5 text-sm font-semibold ${status === s ? "bg-ink text-paper" : "bg-white text-ink-70 border border-line"}`}
          >
            {s ? t(`status_${s}`) : t("all")}
          </Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <p className="card text-ink-70">{t("empty")}</p>
      ) : (
        <ul className="grid gap-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/dashboard/orders/${o.id}`} className="card flex flex-wrap items-center gap-x-4 gap-y-2 hover:border-ink-50">
                <span className="num text-lg font-extrabold">#{o.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{o.customerName}</span>
                  <span className="block truncate text-sm text-ink-70">{o.cityName} · <span className="num">{fmt.format(o.createdAt)}</span></span>
                </span>
                <span className="num font-bold">{formatIQD(o.total, locale)}</span>
                <span className="flex gap-1">
                  {knownRiskFlags(o.riskFlags).length > 0 && (
                    <span className="chip bg-gold/20 text-ink" title={tr("title")} data-testid="risk-badge"><Icon as={TriangleAlert} /> {tr("badge")}</span>
                  )}
                  <StatusBadge status={o.status} />
                  <PaymentBadge status={o.paymentStatus} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
