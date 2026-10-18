import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { listUsers } from "@/server/admin/service";
import { UsersTable } from "@/components/admin/UsersTable";
import { USER_STATUSES, PLATFORM_ROLES, type PlatformRole, type UserStatus } from "@/lib/admin";
import { PageHeader } from "@/components/admin/kit";

export const metadata = { title: "Admin · Users", robots: { index: false } };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const t = await getTranslations("admin");
  const status = (USER_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as UserStatus) : "all";
  const role = (PLATFORM_ROLES as readonly string[]).includes(sp.role ?? "") ? (sp.role as PlatformRole) : "all";
  const res = await listUsers(db(), { q: sp.q, status, role, page: Number(sp.page ?? 1) });
  return (
    <div>
      <PageHeader title={t("u.title")} count={res.total} />
      <UsersTable
        q={sp.q ?? ""}
        status={status}
        role={role}
        page={res.page}
        total={res.total}
        size={res.size}
        me={admin.id}
        rows={res.rows.map((r) => ({ ...r, emailVerifiedAt: r.emailVerifiedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(), storeCount: Number(r.storeCount) }))}
      />
    </div>
  );
}
