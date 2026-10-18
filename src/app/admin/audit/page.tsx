import { getTranslations } from "next-intl/server";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { auditLog } from "@/server/db/schema";
import { listAdminAudit } from "@/server/admin/audit";
import { AuditTable } from "@/components/admin/AuditTable";
import { changedKeys } from "@/lib/admin";
import { PageHeader } from "@/components/admin/kit";

export const metadata = { title: "Admin · Audit", robots: { index: false } };

export default async function AdminAudit({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const t = await getTranslations("admin");
  const date = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null);
  const to = date(sp.to);
  const res = await listAdminAudit(db(), { q: sp.q, action: sp.action, actor: sp.actor, targetType: sp.type || undefined, from: date(sp.from), to: to ? new Date(to.getTime() + 86_399_999) : null, page: Number(sp.page ?? 1), pageSize: 50 });
  const seller = await db().select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(30);
  return (
    <div className="space-y-5">
      <PageHeader title={t("a.title")} count={res.total} />
      <AuditTable
        filters={{ q: sp.q ?? "", action: sp.action ?? "", actor: sp.actor ?? "", type: sp.type ?? "", from: sp.from ?? "", to: sp.to ?? "" }}
        page={res.page}
        total={res.total}
        size={res.size}
        rows={res.rows.map((r) => ({ id: r.id, actor: r.actorEmail, action: r.action, targetType: r.targetType, targetId: r.targetId, targetLabel: r.targetLabel, ip: r.ip, at: r.createdAt.toISOString(), before: r.before ?? null, after: r.after ?? null, changed: changedKeys(r.before ?? null, r.after ?? null) }))}
      />
      <section className="rounded-2xl border border-line bg-white p-4">
        <h2 className="mb-2 text-[15px] font-semibold">{t("a.sellerLog")}</h2>
        <ul className="divide-y divide-line text-sm">
          {seller.length === 0 && <li className="py-3 text-ink-50">{t("c.none")}</li>}
          {seller.map((a) => <li key={a.id} className="flex flex-wrap gap-x-3 py-2"><span className="font-mono text-xs">{a.action}</span><span className="text-xs text-ink-50">{a.detail}</span><span className="ms-auto text-xs text-ink-50" dir="ltr">{a.createdAt.toISOString().slice(0, 16).replace("T", " ")}{a.ip ? ` · ${a.ip}` : ""}</span></li>)}
        </ul>
      </section>
    </div>
  );
}
