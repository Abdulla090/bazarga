"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { adminSetRoleAction } from "@/server/actions/admin";
import { Badge, Btn, Card, Field, fmtDate, inputCls, useAdminAction, useConfirm } from "./kit";

export function AdminTeam({ me, team, sessions }: {
  me: { id: string; role: string };
  team: { id: string; email: string; name: string; role: string; status: string; fromEnv: boolean; createdAt: string }[];
  sessions: { createdAt: string; ip: string | null; userAgent: string | null }[];
}) {
  const t = useTranslations("admin");
  const { run, pending } = useAdminAction();
  const confirm = useConfirm();
  const [email, setEmail] = useState("");
  const owner = me.role === "owner";
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title={t("t.title")} className="lg:col-span-2" testId="admin-team">
        <p className="mb-3 text-xs text-ink-50">{t("t.roles")}</p>
        <ul className="divide-y divide-line text-sm">
          {team.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 py-2">
              <Link href={`/admin/users/${m.id}`} className="min-w-0 flex-1 truncate hover:text-[#2563EB]"><span className="font-medium">{m.name}</span> <span className="text-ink-50" dir="ltr">{m.email}</span>{m.id === me.id && <span className="text-xs text-ink-50"> ({t("t.you")})</span>}</Link>
              <Badge tone={m.fromEnv || m.role === "owner" ? "ink" : "blue"}>{t(`u.role.${m.fromEnv ? "owner" : m.role}`)}</Badge>
              {m.fromEnv && <span className="text-xs text-ink-50">{t("t.fromEnv")}</span>}
              {owner && !m.fromEnv && m.id !== me.id && (
                <span className="flex gap-2">
                  {m.role === "admin" && <Btn disabled={pending} onClick={() => confirm({ title: t("t.makeOwner"), expected: m.email, tone: "primary", confirmLabel: t("t.makeOwner"), onConfirm: (p) => run(() => adminSetRoleAction({ id: m.id, role: "owner", ...p })) })}>{t("t.makeOwner")}</Btn>}
                  <Btn tone="danger" disabled={pending} onClick={() => confirm({ title: t("t.remove"), expected: m.email, confirmLabel: t("t.remove"), onConfirm: (p) => run(() => adminSetRoleAction({ id: m.id, role: "user", ...p })) })}>{t("t.remove")}</Btn>
                </span>
              )}
            </li>
          ))}
        </ul>
        {owner && (
          <form className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4" onSubmit={async (e) => { e.preventDefault(); const r = await run(() => adminSetRoleAction({ email, role: "admin" })); if (r.ok) setEmail(""); }}>
            <div className="min-w-0 flex-1"><Field label={t("t.add")} hint={t("t.addHint")}><input type="email" required dir="ltr" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" data-testid="add-admin-email" /></Field></div>
            <Btn type="submit" tone="primary" disabled={pending || !email} className="mb-5">{t("t.add")}</Btn>
          </form>
        )}
      </Card>
      <Card title={t("t.mySessions")}>
        <ul className="space-y-2 text-xs text-ink-70">
          {sessions.map((s, i) => <li key={i}><span className="font-medium text-ink">{fmtDate(s.createdAt, true)}</span> · <span dir="ltr">{s.ip ?? "—"}</span><p className="truncate text-ink-50">{s.userAgent}</p></li>)}
        </ul>
      </Card>
    </div>
  );
}
