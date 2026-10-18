import { getTranslations } from "next-intl/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { sessions } from "@/server/db/schema";
import { listAdmins } from "@/server/admin/service";
import { AdminTeam } from "@/components/admin/AdminTeam";
import { parseAdminEmails } from "@/lib/admin";
import { PageHeader } from "@/components/admin/kit";

export const metadata = { title: "Admin · Team", robots: { index: false } };

export default async function AdminSettings() {
  const admin = await requireAdmin();
  const t = await getTranslations("admin");
  const envEmails = parseAdminEmails(env().ADMIN_EMAILS);
  const [team, mine] = await Promise.all([
    listAdmins(db(), envEmails),
    db().select({ createdAt: sessions.createdAt, ip: sessions.ip, userAgent: sessions.userAgent }).from(sessions).where(and(eq(sessions.userId, admin.id), gte(sessions.expiresAt, new Date()))).orderBy(desc(sessions.createdAt)).limit(20),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader title={t("t.title")} count={team.length} />
      <AdminTeam
        me={{ id: admin.id, role: admin.role }}
        team={team.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
        sessions={mine.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
      />
    </div>
  );
}
