import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { listWaitlist, waitlistCities, waitlistCount } from "@/server/admin/service";
import { FilterBar, PageHeader, fmtDate } from "@/components/admin/kit";
import { normalizePhone } from "@/lib/phone";

export const metadata = { title: "Admin · Waitlist", robots: { index: false } };

export default async function AdminGrowth({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const t = await getTranslations("admin");
  const [rows, total, cities] = await Promise.all([listWaitlist(db(), sp.q ?? "", 500), waitlistCount(db()), waitlistCities(db())]);
  const signup = `${env().APP_URL.replace(/\/$/, "")}/signup`;
  return (
    <div>
      <PageHeader title={t("nav.growth")} count={total.n} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-[13px] text-ink-50">{t("ov.waitlist")}</p><p className="mt-1 text-2xl font-semibold tabular-nums" dir="ltr" data-testid="waitlist-total">{total.n.toLocaleString("en-US")}</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-[13px] text-ink-50">{t("g.refs")}</p><p className="mt-1 text-2xl font-semibold tabular-nums" dir="ltr">{total.refs.toLocaleString("en-US")}</p></div>
        <div className="col-span-2 rounded-2xl border border-line bg-white p-4"><p className="text-[13px] text-ink-50">{t("g.topCities")}</p>{cities.length ? <p className="mt-1.5 flex flex-wrap gap-1.5 text-xs">{cities.map((c) => <span key={c.city} className="rounded-full bg-[#EFF4FF] px-2.5 py-0.5 text-[#1D4ED8]">{c.city} · {c.n}</span>)}</p> : <p className="mt-1.5 text-sm text-ink-50">—</p>}</div>
      </div>
      <FilterBar q={sp.q} placeholder={t("g.searchPh")} exportHref="/api/admin/export/waitlist" />
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white" data-testid="waitlist-list">
        {rows.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-50">{sp.q ? t("c.none") : t("g.empty")}</li>}
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
      {rows.length < total.n && !sp.q && <p className="mt-3 text-xs text-ink-50">{t("g.showing", { n: rows.length, total: total.n })}</p>}
    </div>
  );
}
