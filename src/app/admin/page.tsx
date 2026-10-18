import { getTranslations } from "next-intl/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { buildInfo } from "@/server/build-info";
import { integrationStatus } from "@/server/integrations";
import { overviewKpis } from "@/server/admin/service";
import { SETTING_KEYS, getFlags, getMaintenance, getSetting } from "@/server/services/platform-settings";
import { AreaChart, Donut, donutColor } from "@/components/charts/charts";
import { FEATURE_FLAGS } from "@/lib/admin";
import { PLAN_IDS } from "@/lib/plans";
import { currentLocale } from "@/server/locale";
import { dirOf } from "@/lib/i18n";

export const metadata = { title: "Admin", robots: { index: false } };

const n = (v: number) => v.toLocaleString("en-US");

async function dbPing(): Promise<{ ok: boolean; ms: number }> {
  const t0 = Date.now();
  try {
    await db().execute(sql`select 1`);
    return { ok: true, ms: Date.now() - t0 };
  } catch {
    return { ok: false, ms: Date.now() - t0 };
  }
}

export default async function AdminOverview() {
  await requireAdmin();
  const t = await getTranslations("admin");
  const rtl = dirOf(await currentLocale()) === "rtl";
  const [k, ping, flags, maint, cron] = await Promise.all([overviewKpis(db()), dbPing(), getFlags(db()), getMaintenance(db()), getSetting(db(), SETTING_KEYS.cronDaily)]);
  const build = buildInfo();
  let integ: ReturnType<typeof integrationStatus> | null = null;
  try { integ = integrationStatus(env(), { serverless: !!process.env.VERCEL }); } catch { integ = null; }
  const cronRun = cron as { at?: string; ok?: boolean } | null;
  const range: [string, string] = [k.signups[0]?.day.slice(5) ?? "", k.signups.at(-1)?.day.slice(5) ?? ""];
  const tiles = [
    { label: t("ov.users"), value: n(k.users), sub: t("ov.sellers") + ": " + n(k.sellers) },
    { label: t("ov.stores"), value: n(k.stores), sub: t("ov.liveStores", { n: k.liveStores }) },
    { label: t("ov.products"), value: n(k.products) },
    { label: t("ov.orders"), value: n(k.orders), sub: t("ov.last30", { n: k.orders30 }) },
    { label: t("ov.gmv"), value: n(k.gmv), sub: t("ov.last30", { n: n(k.gmv30) }) },
    { label: t("ov.mrr"), value: `$${n(k.mrrUsd)}`, sub: t("ov.mrrHint") },
    { label: t("ov.waitlist"), value: n(k.waitlist) },
    { label: t("ov.pending"), value: n(k.pendingUpgrades) },
  ];
  return (
    <div className="space-y-5" data-testid="admin-overview">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("ov.title")}</h1>
      {maint.on && <p className="rounded-2xl border border-[#FEC84B] bg-[#FFFAEB] px-4 py-3 text-sm text-[#B54708]" data-testid="maint-on">{t("ov.maintenanceOn")}</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((x) => (
          <div key={x.label} className="rounded-2xl border border-line bg-white p-4" data-testid="kpi">
            <p className="text-xs font-medium text-ink-50">{x.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums" dir="ltr">{x.value}</p>
            {x.sub && <p className="mt-0.5 text-xs text-ink-70">{x.sub}</p>}
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <section className="rounded-2xl border border-line bg-white p-4 lg:col-span-2">
          <h2 className="mb-2 text-[15px] font-semibold">{t("ov.signups")}</h2>
          <AreaChart series={[{ values: k.signups.map((d) => d.n), kind: "primary" }, { values: k.ordersDaily.map((d) => d.n), kind: "secondary" }]} rtl={rtl} label={t("ov.signups")} xLabels={range} />
          <p className="mt-2 flex gap-4 text-xs text-ink-70">
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[#2563EB]" />{t("ov.signups")}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 border-t border-dashed border-ink-50" />{t("ov.ordersChart")}</span>
          </p>
        </section>
        <section className="rounded-2xl border border-line bg-white p-4">
          <h2 className="mb-3 text-[15px] font-semibold">{t("ov.planMix")}</h2>
          <div className="flex items-center gap-4">
            <Donut values={PLAN_IDS.map((p) => k.planMix[p])} label={t("ov.planMix")} />
            <ul className="space-y-1.5 text-sm">
              {PLAN_IDS.map((p, i) => (
                <li key={p} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: donutColor(i) }} />
                  <span className="capitalize">{p}</span>
                  <span className="tabular-nums text-ink-50">{n(k.planMix[p])}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
      <section className="rounded-2xl border border-line bg-white p-4" data-testid="admin-health">
        <h2 className="mb-3 text-[15px] font-semibold">{t("ov.health")}</h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-ink-50">{t("ov.db")}</dt><dd className={ping.ok ? "text-[#067647]" : "text-[#B42318]"} dir="ltr">{ping.ok ? `ok · ${ping.ms} ms` : "error"}</dd></div>
          <div><dt className="text-ink-50">{t("ov.build")}</dt><dd className="font-mono text-xs" dir="ltr">{build.shortSha ?? "dev"} · {build.env}</dd></div>
          <div><dt className="text-ink-50">{t("ov.cron")}</dt><dd dir="ltr">{cronRun?.at ? `${cronRun.at.slice(0, 16).replace("T", " ")} UTC · ${cronRun.ok ? "ok" : "failed"}` : t("c.never")}</dd></div>
          <div><dt className="text-ink-50">/api/health</dt><dd><a className="text-[#2563EB] underline-offset-2 hover:underline" href="/api/health" target="_blank" rel="noreferrer">JSON ↗</a></dd></div>
        </dl>
        {integ && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-ink-50">{t("ov.integrations")}</p>
            <ul className="flex flex-wrap gap-2 text-xs" dir="ltr">
              <li className="rounded-full bg-[#F2F4F7] px-2.5 py-1">storage: {integ.storage.driver}</li>
              <li className="rounded-full bg-[#F2F4F7] px-2.5 py-1">email: {integ.email.driver}</li>
              {(["cron", "subdomains", "push", "ai"] as const).map((x) => (
                <li key={x} className={`rounded-full px-2.5 py-1 ${integ[x] ? "bg-[#ECFDF3] text-[#067647]" : "bg-[#F2F4F7] text-ink-50"}`}>{x}: {integ[x] ? "on" : "off"}</li>
              ))}
              <li className="rounded-full bg-[#F2F4F7] px-2.5 py-1">aiText: {integ.aiText}</li>
            </ul>
          </div>
        )}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-ink-50">{t("ov.flags")}</p>
          <ul className="flex flex-wrap gap-2 text-xs">
            {FEATURE_FLAGS.map((f) => (
              <li key={f} data-testid={`flag-${f}`} className={`rounded-full px-2.5 py-1 ${flags[f] ? "bg-[#EFF4FF] text-[#1D4ED8]" : "bg-[#FEF3F2] text-[#B42318]"}`}>{t(`site.flag.${f}`)}: {flags[f] ? t("c.on") : t("c.off")}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
