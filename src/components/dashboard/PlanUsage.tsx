import Link from "next/link";

/**
 * "7 of 10 products" with a hairline meter. Unlimited plans show the count only (their safety cap is never shown).
 * Pure server component; numbers are Latin digits passed in as strings by the caller's messages.
 */
export function PlanUsage({ label, used, shown, plan, hint, cta }: { label: string; used: number; shown: number | null; plan: string; hint: string | null; cta: string | null }) {
  const pct = shown ? Math.min(100, Math.round((used / shown) * 100)) : 0;
  const near = shown !== null && pct >= 80;
  return (
    <div data-plan-usage className="grid gap-2 rounded-2xl border border-line bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-ink-70">· {plan}</span>
        {cta && (
          <Link href="/dashboard/upgrade" className={`ms-auto inline-flex min-h-9 items-center rounded-full px-3 text-[13px] font-semibold ${near ? "bg-[#2563EB] text-white" : "text-[#2563EB] hover:underline"}`}>
            {cta}
          </Link>
        )}
      </div>
      {shown !== null && (
        <div className="h-1 overflow-hidden rounded-full bg-ink/[0.06]" role="presentation">
          <div className={`h-full rounded-full ${near ? "bg-[#2563EB]" : "bg-ink/40"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {hint && <p className="text-sm text-[#2563EB]" role="status">{hint}</p>}
    </div>
  );
}
