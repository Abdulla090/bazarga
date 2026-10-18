"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { adminRevokeSessionsAction, adminUpdateUserAction, adminVerifyEmailAction } from "@/server/actions/admin";
import { Badge, Btn, FilterBar, Pager, fmtDate, inputCls, selectCls, useAdminAction } from "./kit";
import { PLATFORM_ROLES, USER_STATUSES } from "@/lib/admin";

export type UserRow = { id: string; email: string; name: string; phone: string | null; role: string; status: string; emailVerifiedAt: string | null; createdAt: string; storeCount: number };

const STATUS_TONE = { active: "green", suspended: "amber", banned: "red" } as const;

export function UsersTable({ rows, q, status, role, page, total, size, me }: { rows: UserRow[]; q: string; status: string; role: string; page: number; total: number; size: number; me: string }) {
  const t = useTranslations("admin");
  const { run, pending } = useAdminAction();
  // Optimistic overlay: edits show at once; a failed save drops its overlay again.
  const [opt, setOpt] = useState<Record<string, Partial<UserRow>>>({});
  const list = rows.map((r) => ({ ...r, ...opt[r.id] }));
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const qs = (p: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), ...(status !== "all" ? { status } : {}), ...(role !== "all" ? { role } : {}), page: String(p) })}`;

  const saveName = async (u: UserRow, name: string) => {
    setEditing(null);
    if (!name.trim() || name === u.name) return;
    setOpt((o) => ({ ...o, [u.id]: { ...o[u.id], name } }));
    const res = await run(() => adminUpdateUserAction({ id: u.id, name }));
    if (!res.ok) setOpt((o) => { const n = { ...o }; delete n[u.id]; return n; });
  };
  const bulk = async (kind: "verify" | "logout") => {
    const ids = [...sel];
    for (const id of ids) {
      await run(() => (kind === "verify" ? adminVerifyEmailAction({ id, verified: true }) : adminRevokeSessionsAction({ id })), t("c.saved"));
    }
    setSel(new Set());
  };
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div>
      <FilterBar q={q} placeholder={t("u.searchPh")} exportHref="/api/admin/export/users">
        <select name="status" defaultValue={status} className={selectCls} aria-label={t("c.status")}>
          <option value="all">{t("c.status")}: {t("c.all")}</option>
          {USER_STATUSES.map((s) => <option key={s} value={s}>{t(`u.status.${s}`)}</option>)}
        </select>
        <select name="role" defaultValue={role} className={selectCls} aria-label={t("c.role")}>
          <option value="all">{t("c.role")}: {t("c.all")}</option>
          {PLATFORM_ROLES.map((r) => <option key={r} value={r}>{t(`u.role.${r}`)}</option>)}
        </select>
      </FilterBar>
      {sel.size > 0 && (
        <div className="sticky top-16 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-ink px-4 py-2 text-sm text-white" data-testid="bulk-bar">
          <span className="me-auto">{t("c.selected", { n: sel.size })}</span>
          <Btn tone="ghost" className="!min-h-9" onClick={() => bulk("verify")} disabled={pending}>{t("u.verify")}</Btn>
          <Btn tone="ghost" className="!min-h-9" onClick={() => bulk("logout")} disabled={pending}>{t("u.forceLogout")}</Btn>
        </div>
      )}
      <p className="mb-2 text-xs text-ink-50">{t("u.edited")}</p>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-start text-sm" data-testid="users-table">
          <thead className="hidden bg-[#F9FAFB] text-xs text-ink-50 md:table-header-group">
            <tr>
              <th className="w-10 px-3 py-2"><input type="checkbox" aria-label={t("c.selectAll")} className="size-4" checked={sel.size === list.length && list.length > 0} onChange={(e) => setSel(e.target.checked ? new Set(list.map((u) => u.id)) : new Set())} /></th>
              <th className="px-3 py-2 text-start font-medium">{t("c.name")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("c.email")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("c.status")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("u.stores")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("c.created")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-50">{t("c.none")}</td></tr>}
            {list.map((u) => (
              <tr key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-3 md:table-row md:p-0" data-testid="user-row">
                <td className="md:px-3 md:py-2"><input type="checkbox" className="size-5 md:size-4" aria-label={u.email} checked={sel.has(u.id)} onChange={() => toggle(u.id)} /></td>
                <td className="min-w-0 flex-1 md:px-3 md:py-2">
                  {editing === u.id ? (
                    <input autoFocus defaultValue={u.name} className={inputCls} aria-label={t("c.name")} onBlur={(e) => saveName(u, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveName(u, (e.target as HTMLInputElement).value); if (e.key === "Escape") setEditing(null); }} data-testid="inline-name" />
                  ) : (
                    <button type="button" className="min-h-11 text-start font-medium hover:text-[#2563EB]" onClick={() => setEditing(u.id)}>{u.name}{u.id === me && <span className="ms-1 text-xs text-ink-50">({t("t.you")})</span>}</button>
                  )}
                </td>
                <td className="w-full truncate text-ink-70 md:w-auto md:px-3 md:py-2" dir="ltr">{u.email}</td>
                <td className="md:px-3 md:py-2">
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={STATUS_TONE[u.status as keyof typeof STATUS_TONE] ?? "gray"}>{t(`u.status.${u.status}`)}</Badge>
                    {u.role !== "user" && <Badge tone="blue">{t(`u.role.${u.role}`)}</Badge>}
                    {!u.emailVerifiedAt && <Badge>{t("u.unverified")}</Badge>}
                  </span>
                </td>
                <td className="tabular-nums text-ink-70 md:px-3 md:py-2">{u.storeCount}</td>
                <td className="text-xs text-ink-50 md:px-3 md:py-2">{fmtDate(u.createdAt)}</td>
                <td className="ms-auto md:px-3 md:py-2 md:text-end">
                  <Link href={`/admin/users/${u.id}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm hover:border-ink/30" data-testid="user-open">{t("c.open")}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} size={size} hrefFor={qs} />
    </div>
  );
}
