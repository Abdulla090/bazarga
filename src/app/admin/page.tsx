import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { listRequests } from "@/server/services/upgrades";
import { activateUpgradeAction, rejectUpgradeAction } from "@/server/actions/upgrade";
import { createPayoutAction, markPayoutPaidAction, reviewPayoutProfileAction } from "@/server/actions/gateway-payments";
import { adminListPayments, adminListPayoutProfiles, adminListPayouts, sellerBalance } from "@/server/payments/gateway/service";
import { gateway } from "@/server/payments/gateway/registry";
import { getPlan, isPaidPlan, usd } from "@/lib/plans";

export const metadata = { title: "Admin", robots: { index: false } };

/** Internal, English-only. Gated by ADMIN_EMAILS (404 otherwise). */
export default async function AdminPage() {
  await requireAdmin();
  const rows = await listRequests(db(), "all");
  const [pays, outs, profiles] = await Promise.all([adminListPayments(db(), 100), adminListPayouts(db(), 100), adminListPayoutProfiles(db())]);
  const balances = new Map(await Promise.all(profiles.map(async (p) => [p.storeId, await sellerBalance(db(), p.storeId)] as const)));
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "—");
  const n = (v: number) => v.toLocaleString("en-US");
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
                {r.plan}{isPaidPlan(r.plan) ? ` (${usd(r.months === 12 ? getPlan(r.plan).yearly : getPlan(r.plan).monthly)})` : ""} · {r.months === 12 ? "12 months" : "1 month"} · {r.method} · now {currentPlan}
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

      <h2 className="mt-14 text-2xl font-light tracking-tight">Online payments</h2>
      <p className="mt-1 text-sm text-ink-70">Gateway: {gateway()?.id ?? "none (PAYMENTS_PROVIDER unset)"}. Status comes only from the provider (webhook / reconcile), never from redirects.</p>
      <div className="mt-4 overflow-x-auto border-y border-line">
        <table className="w-full text-left text-sm">
          <thead className="text-ink-70"><tr><th className="py-2 pe-3">Created</th><th className="pe-3">Kind</th><th className="pe-3">Store</th><th className="pe-3 text-right">IQD</th><th className="pe-3 text-right">Fee</th><th className="pe-3">Status</th><th className="pe-3">Gateway</th><th>Ref</th></tr></thead>
          <tbody className="divide-y divide-line">
            {pays.length === 0 && <tr><td colSpan={8} className="py-6 text-ink-70">No online payments yet.</td></tr>}
            {pays.map((p) => (
              <tr key={p.id}>
                <td className="py-2 pe-3 whitespace-nowrap">{day(p.createdAt)}</td>
                <td className="pe-3">{p.kind}</td>
                <td className="pe-3 font-mono text-xs">{p.storeId.slice(0, 8)}</td>
                <td className="pe-3 text-right tabular-nums">{n(p.amountIqd)}</td>
                <td className="pe-3 text-right tabular-nums">{n(p.commissionIqd)}</td>
                <td className="pe-3">{p.status}</td>
                <td className="pe-3">{p.gateway ?? "—"}</td>
                <td className="font-mono text-xs">{p.providerRef ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-14 text-2xl font-light tracking-tight">Payout profiles</h2>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {profiles.length === 0 && <li className="py-6 text-sm text-ink-70">No payout profiles yet.</li>}
        {profiles.map((p) => (
          <li key={p.storeId} className="flex flex-wrap items-center gap-3 py-4">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{p.accountName} · {p.method} · <span className="font-mono">{p.accountIdentifier}</span></p>
              <p className="text-ink-70">store {p.storeId.slice(0, 8)} · {p.status} · balance {n(balances.get(p.storeId) ?? 0)} IQD · updated {day(p.updatedAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {p.status !== "verified" && <form action={reviewPayoutProfileAction}><input type="hidden" name="storeId" value={p.storeId} /><input type="hidden" name="decision" value="verified" /><button className="min-h-11 rounded-full bg-ink px-5 text-sm text-white">Verify</button></form>}
              {p.status !== "rejected" && <form action={reviewPayoutProfileAction}><input type="hidden" name="storeId" value={p.storeId} /><input type="hidden" name="decision" value="rejected" /><button className="min-h-11 rounded-full border border-line px-5 text-sm">Reject</button></form>}
              {p.status === "verified" && (balances.get(p.storeId) ?? 0) > 0 && <form action={createPayoutAction}><input type="hidden" name="storeId" value={p.storeId} /><button className="min-h-11 rounded-full border border-ink px-5 text-sm">Queue payout</button></form>}
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-14 text-2xl font-light tracking-tight">Payouts</h2>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {outs.length === 0 && <li className="py-6 text-sm text-ink-70">No payouts yet.</li>}
        {outs.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center gap-3 py-4">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium tabular-nums">{n(o.amountIqd)} IQD · {o.method} · <span className="font-mono">{o.accountIdentifier}</span></p>
              <p className="text-ink-70">store {o.storeId.slice(0, 8)} · {o.status} · created {day(o.createdAt)}{o.paidAt ? ` · paid ${day(o.paidAt)}` : ""}{o.reference ? ` · ref ${o.reference}` : ""}</p>
            </div>
            {o.status === "pending" && (
              <form action={markPayoutPaidAction} className="flex gap-2">
                <input type="hidden" name="id" value={o.id} />
                <input name="reference" placeholder="Transfer ref" className="min-h-11 rounded-full border border-line px-4 text-sm" maxLength={120} />
                <button className="min-h-11 rounded-full bg-ink px-5 text-sm text-white">Mark paid</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
