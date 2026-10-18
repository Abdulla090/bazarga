import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { listStores, type StoreFilter } from "@/server/admin/service";
import { StoresTable } from "@/components/admin/StoresTable";
import { PLAN_IDS, type PlanId } from "@/lib/plans";
import { PageHeader } from "@/components/admin/kit";

export const metadata = { title: "Admin · Stores", robots: { index: false } };
const STATES = ["live", "suspended", "unpublished", "featured"] as const;

export default async function AdminStores({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const t = await getTranslations("admin");
  const plan = (PLAN_IDS as readonly string[]).includes(sp.plan ?? "") ? (sp.plan as PlanId) : "all";
  const state = (STATES as readonly string[]).includes(sp.state ?? "") ? (sp.state as StoreFilter["state"]) : "all";
  const res = await listStores(db(), { q: sp.q, plan, state, page: Number(sp.page ?? 1) });
  return (
    <div>
      <PageHeader title={t("s.title")} count={res.total} />
      <StoresTable
        q={sp.q ?? ""}
        plan={plan}
        state={state ?? "all"}
        page={res.page}
        total={res.total}
        size={res.size}
        rows={res.rows.map((r) => ({ ...r, planPeriodEnd: r.planPeriodEnd?.toISOString() ?? null, suspendedAt: r.suspendedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(), productCount: Number(r.productCount), orderCount: Number(r.orderCount) }))}
      />
    </div>
  );
}
