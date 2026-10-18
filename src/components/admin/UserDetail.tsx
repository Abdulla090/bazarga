"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  adminDeleteUserAction,
  adminImpersonateAction,
  adminRevokeSessionsAction,
  adminSetRoleAction,
  adminSetUserStatusAction,
  adminUpdateUserAction,
  adminVerifyEmailAction,
} from "@/server/actions/admin";
import { Badge, Btn, Card, Field, fmtDate, inputCls, useAdminAction, useConfirm } from "./kit";

type U = { id: string; email: string; name: string; phone: string | null; role: string; status: string; effectiveRole: string; locale: string; emailVerifiedAt: string | null; createdAt: string; updatedAt: string };

export function UserDetail({ me, user, owned, memberships, sessions, audit }: {
  me: { id: string; role: string };
  user: U;
  owned: { id: string; name: string; slug: string; plan: string; isActive: boolean; suspendedAt: string | null }[];
  memberships: { storeId: string; name: string; slug: string }[];
  sessions: { id: string; createdAt: string; expiresAt: string; ip: string | null; userAgent: string | null; impersonatedBy: string | null }[];
  audit: { id: string; action: string; actor: string; at: string }[];
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const { run, pending } = useAdminAction();
  const confirm = useConfirm();
  const [form, setForm] = useState({ name: user.name, email: user.email, phone: user.phone ?? "" });
  const self = user.id === me.id;
  const isAdmin = user.effectiveRole !== "user";

  return (
    <div className="space-y-4" data-testid="user-detail">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/users" className="inline-flex min-h-11 items-center text-sm text-ink-50 hover:text-ink">← {t("u.title")}</Link>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-12 place-items-center rounded-full bg-[#EFF4FF] text-lg font-semibold text-[#1D4ED8]">{user.name.slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{user.name}</h1>
          <p className="truncate text-sm text-ink-70" dir="ltr">{user.email}</p>
        </div>
        <span className="flex flex-wrap gap-1.5">
          <Badge tone={user.status === "active" ? "green" : user.status === "banned" ? "red" : "amber"}>{t(`u.status.${user.status}`)}</Badge>
          <Badge tone={isAdmin ? "blue" : "gray"}>{t(`u.role.${user.effectiveRole}`)}</Badge>
          <Badge tone={user.emailVerifiedAt ? "green" : "gray"}>{user.emailVerifiedAt ? t("u.verified") : t("u.unverified")}</Badge>
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t("u.profile")} className="lg:col-span-2">
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => { e.preventDefault(); run(() => adminUpdateUserAction({ id: user.id, ...form })); }}
          >
            <Field label={t("c.name")}><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="user-name" /></Field>
            <Field label={t("c.email")}><input className={inputCls} dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label={t("c.phone")}><input className={inputCls} dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <div className="flex items-end"><Btn type="submit" tone="primary" disabled={pending} data-testid="user-save">{t("c.save")}</Btn></div>
          </form>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            <Btn onClick={() => run(() => adminVerifyEmailAction({ id: user.id, verified: !user.emailVerifiedAt }))} disabled={pending}>{user.emailVerifiedAt ? t("u.unverify") : t("u.verify")}</Btn>
            {!self && <Btn onClick={() => run(() => adminRevokeSessionsAction({ id: user.id }))} disabled={pending} data-testid="user-logout">{t("u.forceLogout")}</Btn>}
            {!isAdmin && user.status === "active" && (
              <Btn tone="primary" disabled={pending} data-testid="user-impersonate" title={t("u.impersonateHint")} onClick={async () => {
                const r = await run(() => adminImpersonateAction({ id: user.id }));
                // Full navigation: the session cookie just changed to the view-as session.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                if (r.ok) window.location.assign("/dashboard");
              }}>{t("u.impersonate")}</Btn>
            )}
            {me.role === "owner" && !self && (
              user.role === "user"
                ? <Btn onClick={() => run(() => adminSetRoleAction({ id: user.id, role: "admin" }))} disabled={pending}>{t("u.makeAdmin")}</Btn>
                : <Btn onClick={() => run(() => adminSetRoleAction({ id: user.id, role: "user" }))} disabled={pending}>{t("u.removeAdmin")}</Btn>
            )}
          </div>
        </Card>

        <Card title={t("u.owns")}>
          <ul className="space-y-2 text-sm">
            {owned.length === 0 && <li className="text-ink-50">{t("c.none")}</li>}
            {owned.map((s) => (
              <li key={s.id}><Link href={`/admin/stores/${s.id}`} className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-2 hover:bg-[#F6F7F9]"><span className="truncate">{s.name} <span className="text-ink-50" dir="ltr">/{s.slug}</span></span><Badge tone={s.suspendedAt ? "amber" : "blue"}>{s.suspendedAt ? t("s.state.suspended") : s.plan}</Badge></Link></li>
            ))}
          </ul>
          {memberships.length > 0 && (
            <>
              <p className="mt-4 text-xs font-medium text-ink-50">{t("u.staffOf")}</p>
              <ul className="mt-1 space-y-1 text-sm">{memberships.map((m) => <li key={m.storeId}><Link className="hover:text-[#2563EB]" href={`/admin/stores/${m.storeId}`}>{m.name}</Link></li>)}</ul>
            </>
          )}
        </Card>
      </div>

      <Card title={t("u.sessions")}>
        <ul className="divide-y divide-line text-sm" data-testid="user-sessions">
          {sessions.length === 0 && <li className="py-3 text-ink-50">{t("c.none")}</li>}
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap gap-x-3 py-2">
              <span className="font-mono text-xs text-ink-50" dir="ltr">{s.id}…</span>
              <span>{fmtDate(s.createdAt, true)}</span>
              <span className="text-ink-50" dir="ltr">{s.ip ?? "—"}</span>
              <span className="min-w-0 flex-1 truncate text-ink-50">{s.userAgent ?? ""}</span>
              {s.impersonatedBy && <Badge tone="amber">{t("u.viewAs")}</Badge>}
            </li>
          ))}
        </ul>
      </Card>

      {!self && (
        <Card title={t("u.danger")} className="border-[#FECDCA]">
          <div className="flex flex-wrap gap-2">
            {user.status === "active" ? (
              <>
                <Btn tone="danger" data-testid="user-suspend" disabled={pending} onClick={() => confirm({ title: t("u.suspend"), expected: user.email, confirmLabel: t("u.suspend"), onConfirm: (p) => run(() => adminSetUserStatusAction({ id: user.id, status: "suspended", ...p })) })}>{t("u.suspend")}</Btn>
                <Btn tone="danger" disabled={pending} onClick={() => confirm({ title: t("u.ban"), expected: user.email, confirmLabel: t("u.ban"), onConfirm: (p) => run(() => adminSetUserStatusAction({ id: user.id, status: "banned", ...p })) })}>{t("u.ban")}</Btn>
              </>
            ) : (
              <Btn tone="primary" data-testid="user-unban" disabled={pending} onClick={() => run(() => adminSetUserStatusAction({ id: user.id, status: "active" }))}>{t("u.unban")}</Btn>
            )}
            <Btn tone="danger" data-testid="user-delete" disabled={pending} onClick={() => confirm({
              title: t("u.deleteUser"), body: t("confirm.irreversible"), expected: user.email, confirmLabel: t("c.delete"),
              onConfirm: async (p) => { const r = await run(() => adminDeleteUserAction({ id: user.id, ...p })); if (r.ok) router.push("/admin/users"); return r; },
            })}>{t("u.deleteUser")}</Btn>
          </div>
        </Card>
      )}

      <Card title={t("a.title")}>
        <ul className="divide-y divide-line text-sm">
          {audit.length === 0 && <li className="py-3 text-ink-50">{t("c.none")}</li>}
          {audit.map((a) => <li key={a.id} className="flex flex-wrap gap-x-3 py-2"><span className="font-mono text-xs">{a.action}</span><span className="text-ink-50" dir="ltr">{a.actor}</span><span className="ms-auto text-xs text-ink-50">{fmtDate(a.at, true)}</span></li>)}
        </ul>
      </Card>
    </div>
  );
}
