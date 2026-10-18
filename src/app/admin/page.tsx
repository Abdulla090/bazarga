import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { overviewKpis } from "@/server/admin/service";
import { getMaintenance } from "@/server/services/platform-settings";
import { AreaChart } from "@/components/charts/charts";
import { PageHeader } from "@/components/admin/kit";
import { ADMIN_PERIODS, parsePeriod } from "@/lib/admin";
import { ORDER_STATUSES } from "@/lib/order-status";
import { PLAN_IDS } from "@/lib/plans";
import { currentLocale } from "@/server/locale";
import { dirOf } from "@/lib/i18n";

export const metadata = { title: "Admin", robots: { index: false } };

const n = (v: number) => v.toLocaleString("en-US");

function Tile({ label, value, sub, href, testId }: { label: string; value: string; sub?: string; href?: string; testId?: string }) {
  const body = (
    <>
      <p className="text-[13px] font-medium text-ink-50">{label}</p>
      <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-tight tabular-nums text-ink" dir="ltr" data-testid={testId ? `${testId}-value` : undefined}>{value}</p>
      {sub && <p className="mt-2 text-xs text-ink-70">{sub}</p>}
    </>
  );
  const cls = "block rounded-2xl border border-line bg-white p-4 sm:p-5";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-[#2563EB]/40`} data-testid={testId ?? "kpi"}>{body}</Link>
  ) : (
    <div className={cls} data-testid={testId ?? "kpi"}>{body}</div>
  );
}

function Bars({ rows, empty, testId }: { rows: { label: string; n: number; tone?: string }[]; empty: string; testId: string }) {
  const total = rows.reduce((s, r) => s + r.n, 0);
  if (total === 0) return <p className="py-6 text-center text-sm text-ink-50" data-testid={`${testId}-empty`}>{empty}</p>;
  const max = Math.max(...rows.map((r) => r.n));
  return (
    <ul className="space-y-2.5" data-testid={testId}>
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-ink-70">{r.label}</span>
            <span className="tabular-nums font-medium text-ink" dir="ltr">{n(r.n)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#F2F4F7]">
            <div className={`h-full rounded-full ${r.tone ?? "bg-[#2563EB]"}`} style={{ width: `${max ? Math.max(r.n ? 2 : 0, (r.n / max) * 100) : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Panel({ title, sub, children, className = "", testId }: { title: string; sub?: string; children: React.ReactNode; className?: string; testId?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-4 sm:p-5 ${className}`} data-testid={testId}>
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
      {sub && <p className="mt-0.5 text-xs text-ink-50">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function AdminOverview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const t = await getTranslations("admin");
  const rtl = dirOf(await currentLocale()) === "rtl";
  const [k, maint] = await Promise.all([overviewKpis(db(), period), getMaintenance(db())]);
  const periodLabel = t(`ov.period.${period}`);
  const range: [string, string] = [k.signups[0]?.day ?? "", k.signups.at(-1)?.day ?? ""];
  const quiet = k.signups.every((d) => d.n === 0) && k.ordersDaily.every((d) => d.n === 0);
  const all = period === "all";
  const aiMonth = k.usage.ai.reduce((s, r) => s + r.month, 0);
  const aiAll = k.usage.ai.reduce((s, r) => s + r.all, 0);
  return (
    <div data-testid="admin-overview">
      <PageHeader
        title={t("ov.title")}
        sub={t("ov.fromDb")}
        actions={
          <nav className="inline-flex rounded-full border border-line bg-white p-1" aria-label={t("ov.periodLabel")} data-testid="period-picker">
            {ADMIN_PERIODS.map((p) => (
              <Link
                key={p}
                href={p === "30d" ? "/admin" : `/admin?period=${p}`}
                aria-current={p === period ? "true" : undefined}
                className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm ${p === period ? "bg-ink font-medium text-white" : "text-ink-70 hover:text-ink"}`}
              >
                {t(`ov.periodShort.${p}`)}
              </Link>
            ))}
          </nav>
        }
      />
      {maint.on && <p className="mb-5 rounded-2xl border border-[#FEC84B] bg-[#FFFAEB] px-4 py-3 text-sm text-[#B54708]" data-testid="maint-on">{t("ov.maintenanceOn")}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile testId="kpi-users" href="/admin/users" label={t("ov.users")} value={n(k.users)} sub={all ? t("ov.verified", { n: n(k.usersVerified) }) : `${t("ov.newIn", { n: n(k.usersNew), period: periodLabel })} · ${t("ov.verified", { n: n(k.usersVerified) })}`} />
        <Tile testId="kpi-stores" href="/admin/stores" label={t("ov.stores")} value={n(k.stores)} sub={`${t("ov.liveStores", { n: k.storesByStatus.live })} · ${t("ov.sellers")}: ${n(k.sellers)}`} />
        <Tile testId="kpi-products" href="/admin/products" label={t("ov.products")} value={n(k.products)} sub={`${t("ov.activeN", { n: n(k.productsActive) })} · ${t("ov.hiddenN", { n: n(k.productsHidden) })}`} />
        <Tile testId="kpi-orders" href="/admin/orders" label={t("ov.orders")} value={n(k.orders)} sub={all ? undefined : t("ov.inPeriod", { n: n(k.ordersInPeriod), period: periodLabel })} />
        <Tile testId="kpi-gmv" label={t("ov.gmvIqd")} value={n(k.gmv)} sub={all ? t("ov.gmvHint") : t("ov.inPeriod", { n: n(k.gmvInPeriod), period: periodLabel })} />
        <Tile testId="kpi-mrr" href="/admin/plans" label={t("ov.mrrEstimate")} value={`$${n(k.mrrUsd)}`} sub={t("ov.mrrFrom", { n: k.activePaidStores })} />
        <Tile testId="kpi-waitlist" href="/admin/growth" label={t("ov.waitlist")} value={n(k.waitlist)} />
        <Tile testId="kpi-pending" href="/admin/plans" label={t("ov.pending")} value={n(k.pendingUpgrades)} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel title={t("ov.signupsVsOrders")} sub={`${periodLabel} · ${range[0]} → ${range[1]}`} className="lg:col-span-2" testId="chart-activity">
          {quiet ? (
            <p className="grid h-56 place-items-center rounded-xl border border-dashed border-line text-sm text-ink-50" data-testid="chart-empty">{t("ov.noActivity")}</p>
          ) : (
            <>
              <AreaChart series={[{ values: k.signups.map((d) => d.n), kind: "primary" }, { values: k.ordersDaily.map((d) => d.n), kind: "secondary" }]} rtl={rtl} label={t("ov.signupsVsOrders")} xLabels={[range[0].slice(5), range[1].slice(5)]} />
              <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-70">
                <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[#2563EB]" />{t("ov.signups")}: <b className="tabular-nums" dir="ltr">{n(k.signups.reduce((a, d) => a + d.n, 0))}</b></span>
                <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 border-t border-dashed border-ink-50" />{t("ov.ordersChart")}: <b className="tabular-nums" dir="ltr">{n(k.ordersDaily.reduce((a, d) => a + d.n, 0))}</b></span>
              </p>
            </>
          )}
        </Panel>
        <Panel title={t("ov.storesByPlan")} sub={t("ov.allTime")} testId="plan-mix">
          <Bars testId="plan-bars" empty={t("ov.noStores")} rows={PLAN_IDS.map((p) => ({ label: `${p[0]!.toUpperCase()}${p.slice(1)}${p !== "free" ? ` · ${t("ov.activePaid", { n: k.activePaid[p] })}` : ""}`, n: k.planMix[p] }))} />
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Panel title={t("ov.storesByStatus")} sub={t("ov.allTime")} testId="stores-status">
          <Bars
            testId="store-status-bars"
            empty={t("ov.noStores")}
            rows={[
              { label: t("s.state.live"), n: k.storesByStatus.live, tone: "bg-[#12B76A]" },
              { label: t("s.state.unpublished"), n: k.storesByStatus.unpublished, tone: "bg-[#98A2B3]" },
              { label: t("s.state.suspended"), n: k.storesByStatus.suspended, tone: "bg-[#F04438]" },
            ]}
          />
        </Panel>
        <Panel title={t("ov.ordersByStatus")} sub={t("ov.allTime")} testId="orders-status">
          <Bars testId="order-status-bars" empty={t("ov.noOrders")} rows={ORDER_STATUSES.map((st) => ({ label: t(`ost.${st}`), n: k.ordersByStatus[st] }))} />
        </Panel>
        <Panel title={t("ov.usage")} sub={t("ov.usageMonth", { month: k.usage.month })} className="md:col-span-2 lg:col-span-1" testId="usage">
          <dl className="divide-y divide-line text-sm">
            <div className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0">
              <dt className="text-ink-70">{t("ov.images")}</dt>
              <dd className="tabular-nums" dir="ltr"><b className="font-medium text-ink">{n(k.usage.images)}</b> <span className="text-xs text-ink-50">· {t("ov.inStorage", { n: n(k.usage.imagesStored) })}</span></dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className="text-ink-70">{t("ov.aiCredits")}</dt>
              <dd className="tabular-nums" dir="ltr"><b className="font-medium text-ink">{n(aiMonth)}</b> <span className="text-xs text-ink-50">· {t("ov.allTimeN", { n: n(aiAll) })}</span></dd>
            </div>
            {k.usage.ai.map((r) => (
              <div key={r.feature} className="flex items-baseline justify-between gap-3 py-2 ps-3 text-xs">
                <dt className="text-ink-50" dir="ltr">{r.feature}</dt>
                <dd className="tabular-nums text-ink-70" dir="ltr">{n(r.month)} / {n(r.all)}</dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-3 py-2.5 last:pb-0">
              <dt className="text-ink-70">{t("ov.studioEdits")}</dt>
              <dd className="tabular-nums" dir="ltr"><b className="font-medium text-ink">{n(k.usage.studioMonth)}</b> <span className="text-xs text-ink-50">· {t("ov.allTimeN", { n: n(k.usage.studioAll) })}</span></dd>
            </div>
          </dl>
        </Panel>
      </div>
      <p className="mt-4 text-xs text-ink-50">{t("ov.mrrNote")}</p>
    </div>
  );
}
