import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getUserDetail } from "@/server/admin/service";
import { listAdminAudit } from "@/server/admin/audit";
import { UserDetail } from "@/components/admin/UserDetail";
import { effectiveRole } from "@/lib/admin";

export const metadata = { title: "Admin · User", robots: { index: false } };

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await getUserDetail(db(), id);
  if (!d) notFound();
  const audit = await listAdminAudit(db(), { q: id, pageSize: 20 });
  const role = effectiveRole({ ...d.user, status: "active" }, env().ADMIN_EMAILS);
  const iso = (x: Date | null) => x?.toISOString() ?? null;
  return (
    <UserDetail
      me={{ id: admin.id, role: admin.role }}
      user={{ ...d.user, effectiveRole: role, emailVerifiedAt: iso(d.user.emailVerifiedAt), createdAt: d.user.createdAt.toISOString(), updatedAt: d.user.updatedAt.toISOString() }}
      owned={d.owned.map((s) => ({ ...s, suspendedAt: iso(s.suspendedAt) }))}
      memberships={d.memberships}
      sessions={d.sessions.map((s) => ({ ...s, createdAt: s.createdAt.toISOString(), expiresAt: s.expiresAt.toISOString() }))}
      audit={audit.rows.map((a) => ({ id: a.id, action: a.action, actor: a.actorEmail, at: a.createdAt.toISOString() }))}
    />
  );
}
