import { EmptyState } from "@/components/dashboard/EmptyState";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { currentLocale } from "@/server/locale";
import { getAnalyticsExtras, getPreviousTotals, getStoreAnalytics } from "@/server/services/analytics";
import { formatIQD } from "@/lib/money";
import { AreaChart, Donut, Sparkline, donutColor } from "@/components/charts/charts";
import { CalendarStrip, FunnelChart, Gauge, Heatmap, Legend, RankedBars, SourceBars, StackedColumns, type StackSeries } from "@/components/charts/viz";
import { SOURCE_COLOR, SOURCE_LABEL } from "@/lib/social";
import { bucketStacks, maxNice, pctChange } from "@/lib/chart-math";
import { ANALYTICS_RANGES, conversionRate, parseRange } from "@/lib/analytics";

export const metadata = { title: "Analytics" };

/**
 * Seller analytics. Server-rendered only (no chart library, no client JS): inline SVG + HTML grids, each with an accessible label.
 * Counting is privacy-friendly and server-side — see src/lib/analytics.ts.
 */
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string | string[] }> }) {
  const { store } = await requireStore();
  const t = await getTranslations("analytics");
  const locale = await currentLocale();
  const range = parseRange((await searchParams).range);
  const [a, prev] = await Promise.all([getStoreAnalytics(db(), store.id, { days: range, locale }), getPreviousTotals(db(), store.id, { days: range })]);
  const x = await getAnalyticsExtras(db(), store.id, { days: range, productIds: [...a.topSold.map((p) => p.productId), ...a.topViewed.map((p) => p.productId)] });
  const rtl = locale !== "en" && locale !== "kmr";
  const nf = new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-IQ-u-nu-latn");
  const dayFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-IQ-u-nu-latn", { day: "numeric", month: "short", timeZone: "UTC" });
  const label = (d: string) => dayFmt.format(new Date(`${d}T00:00:00Z`));
  const topRevenue = Math.max(1, ...a.byCity.map((c) => c.revenue));
  const cityShare = (v: number) => Math.max(v > 0 ? 3 : 0, Math.round((v / topRevenue) * 100));
  const empty = a.totals.visitors === 0 && a.totals.orders === 0;
  const sourceOrders = a.bySource.reduce((acc, r) => acc + r.orders, 0);
  const sourceRows = a.bySource.map((r) => ({
    key: r.source,
    label: r.source === "direct" ? t("sourceDirect") : SOURCE_LABEL[r.source],
    color: SOURCE_COLOR[r.source],
    orders: r.orders,
    ordersLabel: nf.format(r.orders),
    share: sourceOrders > 0 ? `${nf.format(Math.round((r.orders / sourceOrders) * 100))}%` : "—",
    convLabel: r.conversion === null ? "—" : `${nf.format(r.conversion)}%`,
    visitsLabel: t("sourceVisits", { count: r.visits }),
  }));
  const topSource = a.bySource.find((r) => r.source !== "direct" && r.orders > 0);
  const bestConv = [...a.bySource].filter((r) => r.source !== "direct" && r.conversion !== null && r.visits >= 20).sort((p, q) => (q.conversion ?? 0) - (p.conversion ?? 0))[0];

  const kpis: { key: string; value: string; hint?: string; series?: number[]; delta?: number | null }[] = [
    { key: "visitors", value: nf.format(a.totals.visitors), series: a.days.map((d) => d.visitors), delta: pctChange(a.totals.visitors, prev.visitors) },
    { key: "orders", value: nf.format(a.totals.orders), series: a.days.map((d) => d.orders), delta: pctChange(a.totals.orders, prev.orders) },
    { key: "conversion", value: a.totals.conversion === null ? "—" : `${nf.format(a.totals.conversion)}%`, hint: t("conversionHint") },
    { key: "revenue", value: formatIQD(a.totals.revenue, locale), series: a.days.map((d) => d.revenue), delta: pctChange(a.totals.revenue, prev.revenue) },
    { key: "storeViews", value: nf.format(a.totals.storeViews), series: a.days.map((d) => d.storeViews), delta: pctChange(a.totals.storeViews, prev.storeViews) },
    { key: "productViews", value: nf.format(a.totals.productViews), series: a.days.map((d) => d.productViews), delta: pctChange(a.totals.productViews, prev.productViews) },
  ];

  const weekdayFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-IQ-u-nu-latn", { weekday: "short", timeZone: "UTC" });
  // 2026-10-10 is a Saturday: the Iraqi week runs Saturday → Friday.
  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFmt.format(new Date(Date.UTC(2026, 9, 10 + i))));
  const prevConv = conversionRate(prev.orders, prev.visitors);
  const conv = a.totals.conversion ?? 0;
  const gaugeMax = maxNice(Math.max(conv, prevConv ?? 0, 1) * 1.4);
  const funnelSteps = a.funnel.map((s, i) => {
    const before = i > 0 ? a.funnel[i - 1]!.count : 0;
    return {
      key: s.key,
      label: t(`funnel_${s.key}`),
      count: s.count,
      countLabel: nf.format(s.count),
      pctLabel: i > 0 && s.pct !== null ? `${nf.format(s.pct)}%` : null,
      dropLabel: i > 0 && before > 0 ? `${nf.format(Math.max(0, Math.round((1 - s.count / before) * 1000) / 10))}%` : null,
    };
  });
  const STACK: (StackSeries & { group: "delivered" | "confirmed" | "new" | "lost" })[] = [
    { key: "delivered", group: "delivered", label: t("statusDelivered"), bar: "bg-[#0B0F1A]", dot: "bg-[#0B0F1A]" },
    { key: "confirmed", group: "confirmed", label: t("statusConfirmed"), bar: "bg-[#2563EB]", dot: "bg-[#2563EB]" },
    { key: "new", group: "new", label: t("statusNew"), bar: "bg-[#93C5FD]", dot: "bg-[#93C5FD]" },
    { key: "lost", group: "lost", label: t("statusLost"), bar: "bg-[#CBD5E1]", dot: "bg-[#CBD5E1]" },
  ];
  const bucket = range === 90 ? 7 : 1;
  const perDay = x.statusDays.map((d) => STACK.map((s) => d.counts[s.group]));
  const stackCols = bucketStacks(perDay, bucket).map((values, i) => {
    const from = x.statusDays[i * bucket]!.day;
    const to = x.statusDays[Math.min(x.statusDays.length - 1, i * bucket + bucket - 1)]!.day;
    return { values, title: `${label(from)}${to !== from ? ` – ${label(to)}` : ""}: ${STACK.map((s, j) => `${s.label} ${nf.format(values[j]!)}`).join(" · ")}` };
  });
  const statusTotals = STACK.map((s, j) => perDay.reduce((acc, d) => acc + d[j]!, 0));
  const hourTicks = [0, 3, 6, 9, 12, 15, 18, 21].map((h) => [h, String(h)] as [number, string]);
  const heatTotal = x.heat.flat().reduce((acc, n) => acc + n, 0);
  const peak = x.heat.flatMap((row, r) => row.map((n, h) => ({ r, h, n }))).sort((p, q) => q.n - p.n)[0];
  const rankSold = a.topSold.map((p) => ({ id: p.productId, name: p.name, value: p.units, valueLabel: t("units", { count: p.units }), sub: formatIQD(p.revenue, locale), thumb: x.thumbs[p.productId] }));
  const rankViewed = a.topViewed.map((p) => ({ id: p.productId, name: p.name, value: p.views, valueLabel: t("views", { count: p.views }), thumb: x.thumbs[p.productId] }));

  return (
    <div className="grid grid-cols-1 gap-4" data-testid="analytics">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-headline">{t("title")}</h1>
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
      </div>

      <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.key} className="card grid min-w-0 gap-1 p-3" data-kpi={k.key}>
            <dt className="text-sm font-semibold text-ink-70">{t(k.key)}</dt>
            <dd className="num text-xl font-extrabold" dir="ltr">{k.value}</dd>
            {k.hint && <dd className="text-xs text-ink-50">{k.hint}</dd>}
            {k.delta != null && (
              <dd className={`num text-xs font-semibold ${k.delta >= 0 ? "text-[#2563EB]" : "text-ink-50"}`} dir="ltr" title={t("vsPrev")}>
                {k.delta >= 0 ? "▲" : "▼"} {nf.format(Math.abs(k.delta))}%
              </dd>
            )}
            {k.series && <dd><Sparkline values={k.series} rtl={rtl} label={t(k.key)} /></dd>}
          </div>
        ))}
      </dl>

      {empty ? (
        <EmptyState title={t("empty")} help={t("emptyHelp")} href="/dashboard/share" cta={t("emptyCta")} testId="analytics-empty" />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <section className="card grid min-w-0 grid-cols-1 content-start gap-3 lg:col-span-8" aria-labelledby="an-trend" data-testid="trend">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="an-trend" className="text-lg font-bold">{t("trendTitle")}</h2>
              <Legend items={[{ key: "r", label: t("revenue"), dot: "bg-[#2563EB]" }, { key: "v", label: t("visitors"), dot: "bg-ink-50" }]} />
            </div>
            <AreaChart
              rtl={rtl}
              label={`${t("trendTitle")}: ${formatIQD(a.totals.revenue, locale)}`}
              xLabels={[label(a.days[0]!.day), label(a.days[a.days.length - 1]!.day)]}
              series={[{ values: a.days.map((d) => d.revenue), kind: "primary" }, { values: a.days.map((d) => d.visitors), kind: "secondary" }]}
            />
          </section>

          <section className="card grid min-w-0 grid-cols-1 content-start gap-3 lg:col-span-4" aria-labelledby="an-gauge" data-testid="gauge">
            <h2 id="an-gauge" className="text-lg font-bold">{t("conversion")}</h2>
            <Gauge
              value={conv}
              max={gaugeMax}
              prev={prevConv}
              label={`${t("conversion")}: ${a.totals.conversion === null ? "—" : `${nf.format(conv)}%`}`}
              center={a.totals.conversion === null ? "—" : `${nf.format(conv)}%`}
              caption={t("conversionHint")}
            />
            <p className="num text-center text-sm text-ink-70" dir="ltr">
              {prevConv === null ? t("gaugeNoPrev") : t("gaugePrev", { value: nf.format(prevConv) })}
            </p>
          </section>

          <section className="card grid min-w-0 grid-cols-1 content-start gap-4 lg:col-span-12" aria-labelledby="an-source" data-testid="by-source">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
              <div className="min-w-0">
                <h2 id="an-source" className="text-lg font-bold">{t("sourceTitle")}</h2>
                <p className="text-xs text-ink-50">{t("sourceHint")}</p>
              </div>
              {topSource && (
                <p className="text-sm text-ink-70" data-testid="source-top">
                  {t("sourceTop", { source: SOURCE_LABEL[topSource.source as Exclude<typeof topSource.source, "direct">], share: sourceOrders > 0 ? Math.round((topSource.orders / sourceOrders) * 100) : 0 })}
                  {bestConv && bestConv.source !== topSource.source ? ` ${t("sourceBestConv", { source: SOURCE_LABEL[bestConv.source as Exclude<typeof bestConv.source, "direct">] })}` : ""}
                </p>
              )}
            </div>
            {sourceRows.length === 0 ? (
              <p className="text-sm text-ink-50">{t("sourceEmpty")}</p>
            ) : (
              <SourceBars rows={sourceRows} label={`${t("sourceTitle")}: ${sourceRows.map((r) => `${r.label} ${r.ordersLabel}`).join(", ")}`} ordersHeader={t("orders")} convHeader={t("conversion")} />
            )}
          </section>

          <section className="card grid min-w-0 grid-cols-1 content-start gap-3 lg:col-span-5" aria-labelledby="an-funnel" data-testid="funnel">
            <h2 id="an-funnel" className="text-lg font-bold">{t("funnelTitle")}</h2>
            <FunnelChart steps={funnelSteps} label={t("funnelTitle")} />
            <div className="grid min-w-0 gap-1 border-t border-line pt-3" data-testid="wa-taps">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 font-semibold">{t("funnel_whatsapp")}</span>
                <span className="num shrink-0 text-sm text-ink-70" dir="ltr">
                  {nf.format(a.whatsappTaps)}
                  {a.totals.visitors > 0 ? ` · ${nf.format(Math.min(100, Math.round((a.whatsappTaps / a.totals.visitors) * 1000) / 10))}%` : ""}
                </span>
              </div>
              <p className="text-xs text-ink-50">{t("funnelWhatsappHint")}</p>
            </div>
            <p className="text-xs text-ink-50">{t("funnelHint")}</p>
          </section>

          <section className="card grid min-w-0 grid-cols-1 content-start gap-3 lg:col-span-7" aria-labelledby="an-heat" data-testid="heatmap">
            <div>
              <h2 id="an-heat" className="text-lg font-bold">{t("heatTitle")}</h2>
              <p className="text-xs text-ink-50">{t("heatHint", { days: x.heatDays })}</p>
            </div>
            <Heatmap
              matrix={x.heat}
              rowLabels={weekdays}
              hourTicks={hourTicks}
              label={`${t("heatTitle")}: ${t("orderCount", { count: heatTotal })}${peak && peak.n > 0 ? `, ${weekdays[peak.r]} ${peak.h}:00` : ""}`}
              cellTitle={(r, h, n) => `${weekdays[r]} ${String(h).padStart(2, "0")}:00 · ${t("orderCount", { count: n })}`}
            />
          </section>

          <section className="card grid min-w-0 grid-cols-1 content-start gap-3 lg:col-span-7" aria-labelledby="an-status" data-testid="status">
            <h2 id="an-status" className="text-lg font-bold">{t("statusTitle")}</h2>
            <StackedColumns
              columns={stackCols}
              series={STACK}
              label={`${t("statusTitle")}: ${STACK.map((s, j) => `${s.label} ${statusTotals[j]}`).join(", ")}`}
              captions={[label(x.statusDays[0]!.day), label(x.statusDays[x.statusDays.length - 1]!.day)]}
            />
            <Legend items={STACK.map((s, j) => ({ key: s.key, label: s.label, dot: s.dot, value: nf.format(statusTotals[j]!) }))} />
          </section>

          <section className="card grid min-w-0 grid-cols-1 content-start gap-3 lg:col-span-5" aria-labelledby="an-sold" data-testid="top-sold">
            <h2 id="an-sold" className="text-lg font-bold">{t("topSold")}</h2>
            {rankSold.length === 0 ? <p className="text-sm text-ink-50">—</p> : <RankedBars items={rankSold} />}
            <div className="grid gap-3 border-t border-line pt-3" data-testid="top-viewed">
              <h3 className="text-sm font-bold text-ink-70">{t("topViewed")}</h3>
              {rankViewed.length === 0 ? <p className="text-sm text-ink-50">—</p> : <RankedBars items={rankViewed.slice(0, 3)} />}
            </div>
          </section>

          <section className="card grid min-w-0 grid-cols-1 content-start gap-3 lg:col-span-12" aria-labelledby="an-cal" data-testid="calendar">
            <div>
              <h2 id="an-cal" className="text-lg font-bold">{t("calTitle")}</h2>
              <p className="text-xs text-ink-50">{t("calHint")}</p>
            </div>
            <CalendarStrip
              days={x.year.days}
              values={x.year.visitors}
              label={`${t("calTitle")}: ${t("visitors")} ${nf.format(x.year.visitors.reduce((acc, n) => acc + n, 0))}`}
              cellTitle={(d, v) => `${label(d)} · ${t("visitors")} ${nf.format(v)}`}
              lessMore={[t("calLess"), t("calMore")]}
            />
          </section>

          <section className="card grid min-w-0 grid-cols-1 content-start gap-2 lg:col-span-7" aria-labelledby="an-city" data-testid="by-city">
            <h2 id="an-city" className="text-lg font-bold">{t("byCity")}</h2>
            {a.byCity.length === 0 ? (
              <p className="text-sm text-ink-50">—</p>
            ) : (
              <div className="grid items-center gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
                <div className="flex justify-center"><Donut values={a.byCity.map((c) => c.revenue)} label={t("cityShareTitle")} /></div>
                <ol className="grid gap-2">
                  {a.byCity.map((c) => (
                    <li key={c.cityKey} className="grid min-w-0 gap-1" data-city={c.cityKey}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-semibold">{c.city}</span>
                        <span className="num shrink-0 text-sm text-ink-70">{t("orderCount", { count: c.orders })} · {formatIQD(c.revenue, locale)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                        <div className="h-full rounded-full" style={{ width: `${cityShare(c.revenue)}%`, background: donutColor(a.byCity.indexOf(c)) }} />
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>

          <section className="card grid min-w-0 grid-cols-1 content-start gap-2 lg:col-span-5" aria-labelledby="an-cust" data-testid="customers">
            <h2 id="an-cust" className="text-lg font-bold">{t("customersTitle")}</h2>
            <dl className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 text-center">
              {([["customersTotal", a.customers.total], ["customersNew", a.customers.new], ["customersReturning", a.customers.returning]] as const).map(([k, v]) => (
                <div key={k} className="grid min-w-0 gap-1" data-customers={k}>
                  <dd className="num order-2 text-2xl font-extrabold" dir="ltr">{nf.format(v)}</dd>
                  <dt className="order-1 text-xs font-semibold text-ink-70">{t(k)}</dt>
                </div>
              ))}
            </dl>
            <p className="text-xs text-ink-50">{t("customersHint")}</p>
          </section>

          <section className="grid min-w-0 gap-2 lg:col-span-12" aria-labelledby="an-days">
            <h2 id="an-days" className="sr-only">{t("byDay")}</h2>
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
        </div>
      )}
      <p className="text-xs text-ink-50">{t("privacy")}</p>
    </div>
  );
}
