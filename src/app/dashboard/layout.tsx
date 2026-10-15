import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { logOutAction } from "@/server/actions/auth";
import { Awning } from "@/components/Logo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { IntlProvider } from "@/components/IntlProvider";
import { db } from "@/server/db";
import { countNewOrders } from "@/server/services/orders";
import { currentLocale } from "@/server/locale";
import { DashNav } from "@/components/dashboard/DashNav";
import { ExternalLink, Icon } from "@/components/ui/icons";
import { normalizePlan } from "@/lib/plans";
import { isEmailVerified } from "@/server/auth/service";
import { VerifyEmailBanner } from "@/components/dashboard/VerifyEmailBanner";

export const metadata = { title: "Dashboard", robots: { index: false } };

/*
 * Seller shell (REDESIGN step 8 · shell+nav): 64 px translucent header with a hairline (locale switcher lives in More on phones), a 240 px side rail on
 * md+ (three hairline-split groups, selected = white row + blue start tick), a translucent 4-tab bar on phones.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { store, user } = await requireStore();
  const t = await getTranslations("dash");
  const tc = await getTranslations("common");
  const tp = await getTranslations("pricing");
  const plan = normalizePlan(store.plan);
  const locale = await currentLocale();
  const [newOrders, verified] = await Promise.all([countNewOrders(db(), store.id), isEmailVerified(db(), user.id)]);
  return (
    <IntlProvider>
    <div className="min-h-dvh bg-paper pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0 print:min-h-0 print:bg-white print:pb-0">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/80 pt-[env(safe-area-inset-top)] backdrop-blur-md print:hidden">
        <div className="flex h-16 items-center gap-2 ps-[max(1rem,env(safe-area-inset-left))] pe-[max(1rem,env(safe-area-inset-right))] md:px-6">
          <Link href="/dashboard" className="me-auto flex min-h-11 min-w-0 items-center gap-3" aria-label={`Bazarga · ${store.name}`}>
            <Awning className="h-3.5 w-9 shrink-0" />
            <span className="truncate text-[15px] font-medium text-ink">{store.name}</span>
          </Link>
          <Link
            href="/dashboard/upgrade"
            data-plan-chip={plan}
            className={`hidden min-h-9 items-center rounded-full px-3 text-[13px] font-medium transition-colors duration-150 sm:inline-flex ${
              plan === "max" ? "max-chip" : plan === "free" ? "border border-line text-ink/70 hover:text-ink" : "border border-[#2563EB]/40 text-[#2563EB]"
            }`}
          >
            {tp("planChip", { plan: tp(plan) })}
          </Link>
          <div className="hidden md:block"><LocaleSwitcher current={locale} compact /></div>
          <Link href={`/s/${store.slug}`} target="_blank" className="btn-ghost btn-sm" aria-label={t("viewStore")}>
            <span className="hidden sm:inline">{t("viewStore")}</span>
            <Icon as={ExternalLink} className="rtl:-scale-x-100" />
          </Link>
        </div>
      </header>
      <div className="md:grid md:grid-cols-[15rem_minmax(0,1fr)] print:block">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] flex-col border-e border-line px-3 py-6 md:flex print:hidden">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DashNav variant="side" newOrders={newOrders} />
          </div>
          <form action={logOutAction} className="border-t border-line pt-3">
            <button className="flex min-h-11 w-full items-center rounded-lg px-3 text-[14px] text-ink/60 transition-colors duration-150 hover:bg-ink/[0.04] hover:text-ink">{tc("logout")}</button>
          </form>
        </aside>
        <main className="mx-auto w-full min-w-0 max-w-[72rem] px-4 py-6 sm:px-6 md:px-10 md:py-10 print:max-w-none print:p-0">{!verified && <VerifyEmailBanner />}{children}</main>
      </div>
      <DashNav variant="bottom" newOrders={newOrders} />
    </div>
    </IntlProvider>
  );
}
