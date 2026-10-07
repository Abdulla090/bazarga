import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { listOrders, storeStats } from "@/server/services/orders";
import { currentLocale } from "@/server/locale";
import { formatIQD } from "@/lib/money";
import { StatusBadge } from "@/components/dashboard/Badges";
import { CopyButton } from "@/components/CopyButton";
import { LazyInstallPrompt } from "@/components/pwa/lazy";

export default async function DashboardHome() {
  const { store, user } = await requireStore();
  const t = await getTranslations("dash");
  const locale = await currentLocale();
  const [stats, recent] = await Promise.all([storeStats(db(), store.id), listOrders(db(), store.id, { limit: 5 })]);
  const link = `${env().APP_URL}/s/${store.slug}`;
  const cards = [
    { label: t("ordersToday"), value: stats.ordersToday.toLocaleString("en-US") },
    { label: t("revenueWeek"), value: formatIQD(stats.revenueWeek, locale) },
    { label: t("openOrders"), value: stats.openOrders.toLocaleString("en-US") },
  ];
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-extrabold">{t("hello", { name: user.name })}</h1>
      <LazyInstallPrompt />
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <p className="text-sm font-semibold text-ink-70">{c.label}</p>
            <p className="num mt-1 text-2xl font-extrabold">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="card bg-ink text-paper">
        <p className="font-bold">{t("shareTitle")}</p>
        <p className="text-sm text-paper/70">{t("shareSub")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="num rounded-lg bg-white/10 px-3 py-2 text-sm" dir="ltr">{link}</code>
          <CopyButton text={link} />
        </div>
      </div>
      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t("recentOrders")}</h2>
          <Link href="/dashboard/orders" className="text-sm font-semibold underline">{t("seeAll")}</Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-ink-70">{t("noOrders")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((o) => (
              <li key={o.id}>
                <Link href={`/dashboard/orders/${o.id}`} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="num font-bold">#{o.number}</span>
                  <span className="flex-1 truncate">{o.customerName} · {o.cityName}</span>
                  <span className="num font-semibold">{formatIQD(o.total, locale)}</span>
                  <StatusBadge status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
