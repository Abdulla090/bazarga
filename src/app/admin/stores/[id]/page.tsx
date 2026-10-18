import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { getStoreDetail } from "@/server/admin/service";
import { listAdminAudit } from "@/server/admin/audit";
import { StoreDetail } from "@/components/admin/StoreDetail";
import { AI_MONTHLY_LIMIT, STORE_LIMIT, TEAM_LIMIT, normalizePlan, productLimit, studioEditsLimit } from "@/lib/plans";

export const metadata = { title: "Admin · Store", robots: { index: false } };

export default async function AdminStore({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await getStoreDetail(db(), id);
  if (!d) notFound();
  const s = d.store;
  const plan = normalizePlan(s.plan);
  const audit = await listAdminAudit(db(), { q: id, pageSize: 20 });
  const iso = (x: Date | null) => x?.toISOString() ?? null;
  return (
    <StoreDetail
      store={{
        id: s.id, name: s.name, slug: s.slug, phone: s.phone, whatsapp: s.whatsapp, instagram: s.instagram, city: s.city, plan,
        planPeriodEnd: iso(s.planPeriodEnd), isActive: s.isActive, suspendedAt: iso(s.suspendedAt), suspendedReason: s.suspendedReason,
        featured: s.featured, showcaseOptIn: s.showcaseOptIn, whiteLabel: s.whiteLabel, themePreset: s.themePreset, hasTheme: s.themePublished != null, createdAt: s.createdAt.toISOString(),
      }}
      owner={d.owner}
      counts={{ products: Number(d.counts.products), orders: Number(d.counts.orders), members: Number(d.counts.members) }}
      planDefaults={{ products: productLimit(plan), studioEdits: studioEditsLimit(plan), aiCredits: AI_MONTHLY_LIMIT.aiDescriptions[plan], seats: TEAM_LIMIT[plan], stores: STORE_LIMIT[plan] }}
      override={d.override ? { products: d.override.products, studioEdits: d.override.studioEdits, aiCredits: d.override.aiCredits, seats: d.override.seats, stores: d.override.stores, note: d.override.note } : null}
      history={d.history.map((h) => ({ id: h.id, from: h.fromPlan, to: h.toPlan, end: iso(h.periodEnd), reason: h.reason, at: h.createdAt.toISOString() }))}
      audit={audit.rows.map((a) => ({ id: a.id, action: a.action, actor: a.actorEmail, at: a.createdAt.toISOString() }))}
    />
  );
}
