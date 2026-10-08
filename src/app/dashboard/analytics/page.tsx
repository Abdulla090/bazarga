import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { currentLocale } from "@/server/locale";
import { getStoreAnalytics } from "@/server/services/analytics";
import { formatIQD } from "@/lib/money";
import { ANALYTICS_RANGES, barHeights, parseRange, type DayPoint } from "@/lib/analytics";

export const metadata = { title: "Analytics" };

/**
 * Seller analytics. Server-rendered only (no chart library, no client JS): CSS bars plus an accessible table.
 * Counting is privacy-friendly and server-side — see src/lib/analytics.ts.
 */
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string | string[] }> }) {
  const { store } = await requireStore();
  const t = await getTranslations("analytics");
  const locale = await currentLocale();
  const range = parseRange((await searchParams).range);
  const a = await getStoreAnalytics(db(), store.id, { days: range, locale });
  const nf = new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-IQ-u-nu-latn");
  const dayFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-IQ-u-nu-latn", { day: "numeric", month: "short", timeZone: "UTC" });
  const label = (d: string) => dayFmt.format(new Date(`${d}T00:00:00Z`));
  const empty = a.totals.visitors === 0 && a.totals.orders === 0;

  const kpis: { key: string; value: string; hint?: string }[] = [
    { key: "visitors", value: nf.format(a.totals.visitors) },
    { key: "orders", value: nf.format(a.totals.orders) },
    { key: "conversion", value: a.totals.conversion === null ? "—" : `${nf.format(a.totals.conversion)}%`, hint: t("conversionHint") },
    { key: "revenue", value: formatIQD(a.totals.revenue, locale) },
    { key: "storeViews", value: nf.format(a.totals.storeViews) },
    { key: "productViews", value: nf.format(a.totals.productViews) },
  ];

  return (
    <div className="grid grid-cols-1 gap-4" data-testid="analytics">
      <div>
        <h1 className="text-2xl font-extrabold">{t("title")}</h1>
        <p className="text-ink-70">{t("subtitle")}</p>
      </div>
      <nav className="flex flex-wrap gap-1" aria-label={t("byDay")}>
        {ANALYTICS_RANGES.map((r) => (
          <Link
            key={r}
            href={r === 7 ? "/dashboard/analytics" : `/dashboard/analytics?range=${r}`}
            aria-current={range === r ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-sm font-semibold ${range === r ? "bg-ink text-paper" : "border border-line bg-white text-ink-70"}`}
          >
            {t("range", { days: r })}
          </Link>
        ))}
      </nav>

      <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 md:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.key} className="card grid min-w-0 gap-1 p-3" data-kpi={k.key}>
            <dt className="text-sm font-semibold text-ink-70">{t(k.key)}</dt>
            <dd className="num text-xl font-extrabold" dir="ltr">{k.value}</dd>
            {k.hint && <dd className="text-xs text-ink-50">{k.hint}</dd>}
          </div>
        ))}
      </dl>

      {empty && <p className="card text-ink-70" data-testid="analytics-empty">{t("empty")}</p>}

      <section className="card grid grid-cols-1 gap-4" aria-labelledby="an-days">
        <h2 id="an-days" className="text-lg font-bold">{t("byDay")}</h2>
        <Bars title={t("visitorsPerDay")} days={a.days} pick={(d) => d.visitors} label={label} nf={nf} />
        <Bars title={t("ordersPerDay")} days={a.days} pick={(d) => d.orders} label={label} nf={nf} />
        <details>
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold underline">{t("table")}</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm" data-testid="analytics-table">
              <thead>
                <tr className="text-start text-ink-70">
                  <th className="py-1 text-start font-semibold">{t("day")}</th>
                  <th className="py-1 text-end font-semibold">{t("visitors")}</th>
                  <th className="py-1 text-end font-semibold">{t("productViews")}</th>
                  <th className="py-1 text-end font-semibold">{t("orders")}</th>
                  <th className="py-1 text-end font-semibold">{t("revenue")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...a.days].reverse().map((d) => (
                  <tr key={d.day} data-day={d.day}>
                    <td className="num py-1">{label(d.day)}</td>
                    <td className="num py-1 text-end">{nf.format(d.visitors)}</td>
                    <td className="num py-1 text-end">{nf.format(d.productViews)}</td>
                    <td className="num py-1 text-end">{nf.format(d.orders)}</td>
                    <td className="num py-1 text-end">{formatIQD(d.revenue, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <p className="text-xs text-ink-50">{t("ordersNote")}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card grid grid-cols-1 gap-2" aria-labelledby="an-sold" data-testid="top-sold">
          <h2 id="an-sold" className="text-lg font-bold">{t("topSold")}</h2>
          {a.topSold.length === 0 ? (
            <p className="text-sm text-ink-50">—</p>
          ) : (
            <ol className="grid gap-1">
              {a.topSold.map((p) => (
                <li key={p.productId} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold">{p.name}</span>
                  <span className="num shrink-0 text-sm text-ink-70">{t("units", { count: p.units })} · {formatIQD(p.revenue, locale)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="card grid grid-cols-1 gap-2" aria-labelledby="an-viewed" data-testid="top-viewed">
          <h2 id="an-viewed" className="text-lg font-bold">{t("topViewed")}</h2>
          {a.topViewed.length === 0 ? (
            <p className="text-sm text-ink-50">—</p>
          ) : (
            <ol className="grid gap-1">
              {a.topViewed.map((p) => (
                <li key={p.productId} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold">{p.name}</span>
                  <span className="num shrink-0 text-sm text-ink-70">{t("views", { count: p.views })}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      <p className="text-xs text-ink-50">{t("privacy")}</p>
    </div>
  );
}

function Bars({
  title,
  days,
  pick,
  label,
  nf,
}: {
  title: string;
  days: DayPoint[];
  pick: (d: DayPoint) => number;
  label: (day: string) => string;
  nf: Intl.NumberFormat;
}) {
  const values = days.map(pick);
  const heights = barHeights(values);
  return (
    <figure className="grid gap-1">
      <figcaption className="text-sm font-semibold text-ink-70">{title}</figcaption>
      {/* Oldest → newest follows the reading direction (right-to-left in ku/ar). Decorative: the table has the numbers. */}
      <div className="flex h-28 items-end gap-px border-b border-line" aria-hidden="true">
        {days.map((d, i) => (
          <div key={d.day} className="flex h-full min-w-0 flex-1 items-end" title={`${label(d.day)}: ${nf.format(values[i]!)}`}>
            <div className="w-full rounded-t-sm bg-green" style={{ height: `${Math.max(heights[i]!, values[i]! > 0 ? 3 : 0)}%` }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-ink-50" aria-hidden="true">
        <span className="num">{label(days[0]!.day)}</span>
        <span className="num">{label(days[days.length - 1]!.day)}</span>
      </div>
    </figure>
  );
}
