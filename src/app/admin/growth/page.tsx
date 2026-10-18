import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { listWaitlist } from "@/server/admin/service";
import { FilterBar, fmtDate } from "@/components/admin/kit";
import { normalizePhone } from "@/lib/phone";

export const metadata = { title: "Admin · Waitlist", robots: { index: false } };

export default async function AdminGrowth({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const t = await getTranslations("admin");
  const rows = await listWaitlist(db(), sp.q ?? "", 500);
  const signup = `${env().APP_URL.replace(/\/$/, "")}/signup`;
  const cities = Object.entries(rows.reduce<Record<string, number>>((m, r) => ((m[r.city] = (m[r.city] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const refs = rows.reduce((n, r) => n + r.referralCount, 0);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("g.title")}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-ink-50">{t("ov.waitlist")}</p><p className="text-2xl font-semibold tabular-nums">{rows.length}</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-ink-50">{t("g.refs")}</p><p className="text-2xl font-semibold tabular-nums">{refs}</p></div>
        <div className="col-span-2 rounded-2xl border border-line bg-white p-4"><p className="text-xs text-ink-50">{t("g.topCities")}</p><p className="mt-1 flex flex-wrap gap-1.5 text-xs">{cities.map(([c, n]) => <span key={c} className="rounded-full bg-[#EFF4FF] px-2.5 py-0.5 text-[#1D4ED8]">{c} · {n}</span>)}</p></div>
      </div>
      <FilterBar q={sp.q} placeholder={t("g.searchPh")} exportHref="/api/admin/export/waitlist" />
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white" data-testid="waitlist-list">
        {rows.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-50">{t("c.none")}</li>}
        {rows.map((r) => {
          const wa = normalizePhone(r.whatsapp);
          const msg = t("g.inviteMsg", { name: r.name.split(" ")[0] ?? r.name, url: `${signup}?ref=${r.refCode}` });
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.name} <span className="text-xs text-ink-50">#{r.seq}</span></p>
                <p className="truncate text-xs text-ink-50">{r.sells} · {r.city} · <span dir="ltr">{r.whatsapp}</span>{r.instagram ? <> · <span dir="ltr">@{r.instagram}</span></> : null} · {fmtDate(r.createdAt)}</p>
              </div>
              <span className="rounded-full bg-[#F2F4F7] px-2.5 py-0.5 text-xs">{t("g.refs")}: {r.referralCount}</span>
              {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full bg-[#25D366] px-4 text-sm font-medium text-white">{t("g.invite")}</a>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
