import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { listRequests } from "@/server/services/upgrades";
import { listOverrides } from "@/server/admin/service";
import { UpgradeButtons } from "@/components/admin/UpgradeButtons";
import { LIMIT_KEYS } from "@/lib/admin";
import { AI_MONTHLY_LIMIT, PLAN_IDS, STORE_LIMIT, TEAM_LIMIT, getPlan, productLimit, studioEditsLimit } from "@/lib/plans";
import { PageHeader } from "@/components/admin/kit";

export const metadata = { title: "Admin · Plans", robots: { index: false } };

export default async function AdminPlans() {
  await requireAdmin();
  const t = await getTranslations("admin");
  const [reqs, overrides] = await Promise.all([listRequests(db(), "all"), listOverrides(db())]);
  const rows: [string, (p: (typeof PLAN_IDS)[number]) => string][] = [
    [t("pl.monthly"), (p) => (p === "free" ? "0" : String(getPlan(p).monthly))],
    [t("s.lim.products"), (p) => productLimit(p).toLocaleString("en-US")],
    [t("s.lim.studioEdits"), (p) => String(studioEditsLimit(p))],
    [t("s.lim.aiCredits"), (p) => String(AI_MONTHLY_LIMIT.aiDescriptions[p])],
    [t("s.lim.seats"), (p) => String(TEAM_LIMIT[p])],
    [t("s.lim.stores"), (p) => String(STORE_LIMIT[p])],
  ];
  return (
    <div className="space-y-5">
      <PageHeader title={t("pl.title")} sub={t("pl.sub", { pending: reqs.filter((x) => x.r.status === "pending").length, overrides: overrides.length })} />
      <section className="overflow-x-auto rounded-2xl border border-line bg-white" data-testid="plan-matrix">
        <h2 className="px-4 pt-4 text-[15px] font-semibold">{t("pl.matrix")}</h2>
        <table className="mt-2 w-full min-w-[520px] text-sm">
          <thead className="text-xs text-ink-50"><tr><th className="px-4 py-2 text-start font-medium" />{PLAN_IDS.map((p) => <th key={p} className="px-4 py-2 text-end font-medium capitalize">{p}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{rows.map(([label, f]) => <tr key={label}><td className="px-4 py-2 text-ink-70">{label}</td>{PLAN_IDS.map((p) => <td key={p} className="px-4 py-2 text-end tabular-nums" dir="ltr">{f(p)}</td>)}</tr>)}</tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-line bg-white p-4" data-testid="upgrade-requests">
        <h2 className="mb-2 text-[15px] font-semibold">{t("pl.upgrades")}</h2>
        <ul className="divide-y divide-line">
          {reqs.length === 0 && <li className="py-6 text-sm text-ink-50">{t("c.none")}</li>}
          {reqs.map(({ r, storeName, slug, currentPlan, end }) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{storeName} <span className="text-ink-50" dir="ltr">/{slug}</span></p>
                <p className="text-xs text-ink-70">{currentPlan} → {r.plan} · {t("pl.months", { n: r.months })} · {r.method} · {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}{end ? ` · ${end.toISOString().slice(0, 10)}` : ""}</p>
              </div>
              {r.status === "pending" ? <UpgradeButtons id={r.id} /> : <span className="rounded-full bg-[#F2F4F7] px-2.5 py-0.5 text-xs text-ink-70">{r.status}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-white p-4" data-testid="overrides-list">
        <h2 className="mb-2 text-[15px] font-semibold">{t("pl.overrides")}</h2>
        <p className="mb-2 text-xs text-ink-50">{t("s.limitsHint")}</p>
        <ul className="divide-y divide-line text-sm">
          {overrides.length === 0 && <li className="py-6 text-ink-50">{t("c.none")}</li>}
          {overrides.map(({ o, name, slug, plan }) => (
            <li key={o.storeId} className="flex flex-wrap items-center gap-3 py-3">
              <Link href={`/admin/stores/${o.storeId}`} className="min-w-0 flex-1 font-medium hover:text-[#2563EB]">{name} <span className="text-ink-50" dir="ltr">/{slug} · {plan}</span></Link>
              <span className="flex flex-wrap gap-1.5 text-xs">{LIMIT_KEYS.filter((k) => o[k] != null).map((k) => <span key={k} className="rounded-full bg-[#EFF4FF] px-2.5 py-0.5 text-[#1D4ED8]">{t(`s.lim.${k}`)}: {o[k]}</span>)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
