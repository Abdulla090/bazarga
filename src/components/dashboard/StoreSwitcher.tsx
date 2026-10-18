import Link from "next/link";
import { switchStoreAction } from "@/server/actions/stores";
import { ChevronDown, Icon } from "@/components/ui/icons";

type S = { id: string; name: string; slug: string; role: "owner" | "staff" };

/**
 * Header store switcher for accounts with more than one store. Native <details> + form POSTs: opens and switches
 * without JS. Current store is marked; "Manage stores" goes to /dashboard/stores.
 */
export function StoreSwitcher({ current, stores, labels }: { current: S; stores: S[]; labels: { switch: string; manage: string; staff: string } }) {
  return (
    <details className="group relative me-auto min-w-0" data-store-switcher>
      <summary className="flex min-h-11 min-w-0 cursor-pointer list-none items-center gap-2 rounded-lg px-1 [&::-webkit-details-marker]:hidden" aria-label={labels.switch}>
        <span className="truncate text-[15px] font-medium text-ink">{current.name}</span>
        <Icon as={ChevronDown} className="shrink-0 text-ink/60 transition-transform duration-150 group-open:rotate-180" />
      </summary>
      <div className="absolute start-0 top-full z-30 mt-2 grid w-72 max-w-[calc(100vw-2rem)] gap-1 rounded-2xl border border-line bg-white p-2 shadow-lg">
        {stores.map((s) => (
          <form key={s.id} action={switchStoreAction}>
            <input type="hidden" name="storeId" value={s.id} />
            <button
              className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-start text-[14px] ${s.id === current.id ? "bg-ink/[0.05] font-semibold text-ink" : "text-ink/80 hover:bg-ink/[0.04]"}`}
              aria-current={s.id === current.id ? "true" : undefined}
              data-testid="switch-store"
            >
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              {s.role === "staff" && <span className="rounded-full border border-line px-2 text-[12px] text-ink/60">{labels.staff}</span>}
              {s.id === current.id && <span aria-hidden className="h-2 w-2 rounded-full bg-[#2563EB]" />}
            </button>
          </form>
        ))}
        <Link href="/dashboard/stores" className="flex min-h-11 items-center rounded-lg border-t border-line px-3 text-[14px] font-medium text-[#2563EB]">{labels.manage}</Link>
      </div>
    </details>
  );
}
