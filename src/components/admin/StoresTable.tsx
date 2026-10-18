"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { adminUpdateStoreAction } from "@/server/actions/admin";
import { Badge, Btn, FilterBar, Pager, Switch, fmtDate, selectCls, useAdminAction } from "./kit";
import { PLAN_IDS } from "@/lib/plans";

export type StoreRow = { id: string; name: string; slug: string; plan: string; planPeriodEnd: string | null; isActive: boolean; suspendedAt: string | null; featured: boolean; showcaseOptIn: boolean; createdAt: string; ownerId: string; ownerEmail: string; productCount: number; orderCount: number };

export function StoresTable({ rows, q, plan, state, page, total, size }: { rows: StoreRow[]; q: string; plan: string; state: string; page: number; total: number; size: number }) {
  const t = useTranslations("admin");
  const { run, pending } = useAdminAction();
  const [opt, setOpt] = useState<Record<string, Partial<StoreRow>>>({});
  const list = rows.map((r) => ({ ...r, ...opt[r.id] }));
  const [sel, setSel] = useState<Set<string>>(new Set());
  const qs = (p: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), ...(plan !== "all" ? { plan } : {}), ...(state !== "all" ? { state } : {}), page: String(p) })}`;

  const setFeatured = async (s: StoreRow, featured: boolean) => {
    setOpt((o) => ({ ...o, [s.id]: { ...o[s.id], featured } }));
    const r = await run(() => adminUpdateStoreAction({ id: s.id, featured }));
    if (!r.ok) setOpt((o) => ({ ...o, [s.id]: { ...o[s.id], featured: s.featured } }));
  };
  const bulkFeature = async (featured: boolean) => {
    for (const id of sel) {
      setOpt((o) => ({ ...o, [id]: { ...o[id], featured } }));
      await run(() => adminUpdateStoreAction({ id, featured }));
    }
    setSel(new Set());
  };
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const stateOf = (s: StoreRow) => (s.suspendedAt ? (["amber", t("s.state.suspended")] as const) : !s.isActive ? (["gray", t("s.state.unpublished")] as const) : (["green", t("s.state.live")] as const));

  return (
    <div>
      <FilterBar q={q} placeholder={t("s.searchPh")} exportHref="/api/admin/export/stores">
        <select name="plan" defaultValue={plan} className={selectCls} aria-label={t("c.plan")}>
          <option value="all">{t("c.plan")}: {t("c.all")}</option>
          {PLAN_IDS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select name="state" defaultValue={state} className={selectCls} aria-label={t("c.status")}>
          <option value="all">{t("c.status")}: {t("c.all")}</option>
          {(["live", "suspended", "unpublished", "featured"] as const).map((s) => <option key={s} value={s}>{t(`s.state.${s}`)}</option>)}
        </select>
      </FilterBar>
      {sel.size > 0 && (
        <div className="sticky top-16 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-ink px-4 py-2 text-sm text-white" data-testid="bulk-bar">
          <span className="me-auto">{t("c.selected", { n: sel.size })}</span>
          <Btn className="!min-h-9" onClick={() => bulkFeature(true)} disabled={pending}>{t("s.feature")}</Btn>
          <Btn className="!min-h-9" onClick={() => bulkFeature(false)} disabled={pending}>{t("s.unfeature")}</Btn>
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-sm" data-testid="stores-table">
          <thead className="hidden bg-[#F9FAFB] text-xs text-ink-50 md:table-header-group">
            <tr>
              <th className="w-10 px-3 py-2"><input type="checkbox" className="size-4" aria-label={t("c.selectAll")} checked={sel.size === list.length && list.length > 0} onChange={(e) => setSel(e.target.checked ? new Set(list.map((s) => s.id)) : new Set())} /></th>
              <th className="px-3 py-2 text-start font-medium">{t("c.store")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("c.owner")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("c.plan")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("c.status")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("s.products")} / {t("s.orders")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("s.state.featured")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-ink-50">{t("c.none")}</td></tr>}
            {list.map((s) => {
              const [tone, label] = stateOf(s);
              return (
                <tr key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-3 md:table-row md:p-0" data-testid="store-row">
                  <td className="md:px-3 md:py-2"><input type="checkbox" className="size-5 md:size-4" aria-label={s.slug} checked={sel.has(s.id)} onChange={() => toggle(s.id)} /></td>
                  <td className="min-w-0 flex-1 md:px-3 md:py-2"><p className="font-medium">{s.name}</p><p className="text-xs text-ink-50" dir="ltr">/{s.slug}</p></td>
                  <td className="w-full truncate text-ink-70 md:w-auto md:px-3 md:py-2" dir="ltr"><Link href={`/admin/users/${s.ownerId}`} className="hover:text-[#2563EB]">{s.ownerEmail}</Link></td>
                  <td className="md:px-3 md:py-2"><Badge tone={s.plan === "free" ? "gray" : "blue"}>{s.plan}</Badge>{s.planPeriodEnd && <span className="ms-1 text-xs text-ink-50">→ {fmtDate(s.planPeriodEnd)}</span>}</td>
                  <td className="md:px-3 md:py-2"><Badge tone={tone}>{label}</Badge></td>
                  <td className="tabular-nums text-ink-70 md:px-3 md:py-2">{s.productCount} / {s.orderCount}</td>
                  <td className="md:px-3 md:py-2"><Switch on={s.featured} onChange={(v) => setFeatured(s, v)} label={t("s.feature")} testId="store-featured" /></td>
                  <td className="ms-auto md:px-3 md:py-2 md:text-end"><Link href={`/admin/stores/${s.id}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 hover:border-ink/30" data-testid="store-open">{t("c.open")}</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} size={size} hrefFor={qs} />
    </div>
  );
}
