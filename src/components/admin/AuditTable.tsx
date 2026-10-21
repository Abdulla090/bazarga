"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Btn, Pager, fmtDate, inputCls, selectCls } from "./kit";

const EXPORT_AUDIT = "/api/admin/export/audit";
type Row = { id: string; actor: string; action: string; targetType: string; targetId: string | null; targetLabel: string | null; ip: string | null; at: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; changed: string[] };
type F = { q: string; action: string; actor: string; type: string; from: string; to: string };

export function AuditTable({ rows, filters, page, total, size }: { rows: Row[]; filters: F; page: number; total: number; size: number }) {
  const t = useTranslations("admin");
  const [open, setOpen] = useState<string | null>(null);
  const qs = (p: number) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page: String(p) })}`;
  const tone = (a: string) => (/delete|ban|suspend|transfer|maintenance_on|reset/.test(a) ? "text-[#B42318]" : /impersonate/.test(a) ? "text-[#B54708]" : "text-[#1D4ED8]");
  return (
    <div>
      <form method="get" className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-7" role="search">
        <input name="q" defaultValue={filters.q} placeholder={t("c.search")} aria-label={t("c.search")} className={`${inputCls} lg:col-span-2`} />
        <input name="action" defaultValue={filters.action} placeholder={t("a.actionPh")} aria-label={t("a.action")} className={inputCls} dir="ltr" />
        <input name="actor" defaultValue={filters.actor} placeholder={t("a.actorPh")} aria-label={t("a.actor")} className={inputCls} dir="ltr" />
        <select name="type" defaultValue={filters.type} className={selectCls} aria-label={t("a.target")}>
          <option value="">{t("a.target")}: {t("c.all")}</option>
          {["user", "store", "product", "order", "upgrade", "setting"].map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <input type="date" name="from" defaultValue={filters.from} aria-label="From date" className={inputCls} dir="ltr" />
        <input type="date" name="to" defaultValue={filters.to} aria-label="To date" className={inputCls} dir="ltr" />
        <div className="flex gap-2 sm:col-span-3 lg:col-span-7">
          <Btn type="submit" tone="ink">{t("c.filter")}</Btn>
          <a href={EXPORT_AUDIT} className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-sm font-medium">{t("c.export")}</a>
        </div>
      </form>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white" data-testid="audit-list">
        {rows.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-50">{t("c.none")}</li>}
        {rows.map((r) => (
          <li key={r.id} className="text-sm" data-testid="audit-row">
            <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id} className="flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-start hover:bg-[#F9FAFB]">
              <span className={`font-mono text-xs font-medium ${tone(r.action)}`} dir="ltr">{r.action}</span>
              <span className="min-w-0 flex-1 truncate">{r.targetType}{r.targetLabel ? ` · ${r.targetLabel}` : ""}</span>
              {r.changed.length > 0 && <span className="hidden text-xs text-ink-50 sm:inline">{t("a.changed")}: {r.changed.slice(0, 4).join(", ")}</span>}
              <span className="text-xs text-ink-50" dir="ltr">{r.actor}</span>
              <span className="text-xs text-ink-50" dir="ltr">{fmtDate(r.at, true)}{r.ip ? ` · ${r.ip}` : ""}</span>
            </button>
            {open === r.id && (
              <div className="grid gap-3 bg-[#F9FAFB] px-3 pb-3 md:grid-cols-2">
                {(["before", "after"] as const).map((k) => (
                  <div key={k}>
                    <p className="mb-1 text-xs font-medium text-ink-50">{t(`a.${k}`)}</p>
                    <pre className="max-h-64 overflow-auto rounded-xl border border-line bg-white p-3 text-xs" dir="ltr">{r[k] ? JSON.stringify(r[k], null, 2) : "—"}</pre>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      <Pager page={page} total={total} size={size} hrefFor={qs} />
    </div>
  );
}
