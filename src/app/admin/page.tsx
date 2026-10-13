import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { listRequests } from "@/server/services/upgrades";
import { activateUpgradeAction, rejectUpgradeAction } from "@/server/actions/upgrade";

export const metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Internal, English-only. Gated by ADMIN_EMAILS (404 otherwise). */
export default async function AdminPage() {
  await requireAdmin();
  const rows = await listRequests(db(), "all");
  return (
    <main className="mx-auto max-w-4xl px-4 py-10" dir="ltr" lang="en">
      <h1 className="text-3xl font-light tracking-tight">Upgrade requests</h1>
      <p className="mt-1 text-sm text-ink-70">Activate after payment arrives (FIB, ZainCash or cash). Extends from the current period end if still active.</p>
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {rows.length === 0 && <li className="py-6 text-sm text-ink-70">No requests yet.</li>}
        {rows.map(({ r, storeName, slug, currentPlan, end }) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{storeName} <span className="text-ink-70">/{slug}</span></p>
              <p className="text-sm text-ink-70">
                {r.plan} · {r.months === 12 ? "12 months" : "1 month"} · {r.method} · now {currentPlan}
                {end ? ` until ${end.toISOString().slice(0, 10)}` : ""} · {r.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {r.status}
              </p>
            </div>
            {r.status === "pending" && (
              <div className="flex gap-2">
                <form action={activateUpgradeAction}><input type="hidden" name="id" value={r.id} /><button className="min-h-11 rounded-full bg-ink px-5 text-sm text-white">Activate</button></form>
                <form action={rejectUpgradeAction}><input type="hidden" name="id" value={r.id} /><button className="min-h-11 rounded-full border border-line px-5 text-sm">Reject</button></form>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
