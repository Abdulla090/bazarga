import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { listOrders, storeStats } from "@/server/services/orders";
import { currentLocale } from "@/server/locale";
import { formatIQD } from "@/lib/money";
import { StatusBadge } from "@/components/dashboard/Badges";
import { ShareLinkButtons } from "@/components/dashboard/ShareLinkButtons";
import { SetupChecklist } from "@/components/dashboard/SetupChecklist";
import { getSetupChecklist } from "@/server/services/setup";
import { LazyInstallPrompt } from "@/components/pwa/lazy";

export default async function DashboardHome() {
  const { store, user } = await requireStore();
  const t = await getTranslations("dash");
  const locale = await currentLocale();
  const [stats, recent, checklist] = await Promise.all([
    storeStats(db(), store.id),
    listOrders(db(), store.id, { limit: 5 }),
    getSetupChecklist(db(), store.id),
  ]);
  const link = `${env().APP_URL}/s/${store.slug}`;
  const cards = [
    { label: t("ordersToday"), value: stats.ordersToday.toLocaleString("en-US") },
    { label: t("revenueWeek"), value: formatIQD(stats.revenueWeek, locale) },
    { label: t("openOrders"), value: stats.openOrders.toLocaleString("en-US") },
  ];
  return (
    <div className="grid gap-10">
      <h1 className="t-headline">{t("hello", { name: user.name })}</h1>
      <LazyInstallPrompt />
      <SetupChecklist checklist={checklist} storeUrl={link} storeName={store.name} />
      <dl className="grid grid-cols-1 border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-line rtl:sm:divide-x-reverse">
        {cards.map((c, i) => (
          <div key={c.label} className={`py-5 sm:px-6 sm:py-8 ${i === 0 ? "sm:ps-0" : ""} ${i > 0 ? "border-t border-line sm:border-t-0" : ""}`}>
            <dt className="t-label text-ink-70">{c.label}</dt>
            <dd className="num t-headline mt-2">{c.value}</dd>
          </div>
        ))}
      </dl>
      <section className="grid gap-4 border-b border-line pb-10 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-5">
          <h2 className="t-title">{t("shareTitle")}</h2>
          <p className="mt-1 text-sm text-ink-70">{t("shareSub")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:col-span-7 lg:justify-end">
          <code className="num min-h-11 max-w-full truncate rounded-full border border-line bg-white px-4 py-3 text-sm" dir="ltr">{link}</code>
          <ShareLinkButtons url={link} title={store.name} variant="ink" />
        </div>
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="t-title">{t("recentOrders")}</h2>
          <Link href="/dashboard/orders" className="inline-flex min-h-11 items-center text-sm font-medium text-gold hover:underline">{t("seeAll")}</Link>
        </div>
        {recent.length === 0 ? (
          <p className="border-t border-line py-8 text-ink-70">{t("noOrders")}</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {recent.map((o) => (
              <li key={o.id}>
                <Link href={`/dashboard/orders/${o.id}`} className="grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 py-3 hover:bg-white/60 sm:grid-cols-[5rem_1fr_9rem_8rem]">
                  <span className="num font-medium">#{o.number}</span>
                  <span className="truncate">{o.customerName} · {o.cityName}</span>
                  <span className="num text-end font-medium sm:order-3">{formatIQD(o.total, locale)}</span>
                  <span className="col-span-3 sm:order-4 sm:col-span-1 sm:justify-self-end"><StatusBadge status={o.status} /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
