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
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { DashNav } from "@/components/dashboard/DashNav";
import { ExternalLink, Icon } from "@/components/ui/icons";
import { normalizePlan } from "@/lib/plans";
import { isEmailVerified } from "@/server/auth/service";
import { VerifyEmailBanner } from "@/components/dashboard/VerifyEmailBanner";
import { PendingButton } from "@/components/ui/PendingButton";
import { StoreSwitcher } from "@/components/dashboard/StoreSwitcher";
import { listAccessibleStores } from "@/server/services/store-access";
import { AnnouncementBar } from "@/components/site/AnnouncementBar";
import { StatusPage } from "@/components/site/StatusPage";
import { announcementFor, maintenanceFor } from "@/server/admin/site-gate";
import { endImpersonationAction } from "@/server/actions/admin";

export const metadata = { title: "Dashboard", robots: { index: false } };

/*
 * Seller shell (REDESIGN step 8 · shell+nav): 64 px translucent header with a hairline (locale switcher lives in More on phones), a 240 px side rail on
 * md+ (three hairline-split groups, selected = white row + blue start tick), a translucent 4-tab bar on phones.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { store, user, role } = await requireStore();
  const t = await getTranslations("dash");
  const tc = await getTranslations("common");
  const tp = await getTranslations("pricing");
  const plan = normalizePlan(store.plan);
  const locale = await currentLocale();
  const [newOrders, verified, stores, maint, ann] = await Promise.all([countNewOrders(db(), store.id), isEmailVerified(db(), user.id), listAccessibleStores(db(), user.id), maintenanceFor(), announcementFor(locale)]);
  // Admin maintenance mode (docs/ADMIN.md): sellers see the maintenance page; a view-as session too (the admin bypass is the admin's own session).
  if (maint) {
    const ts = await getTranslations("site");
    return <StatusPage title={ts("maintenance.title")} body={maint.message || ts("maintenance.body")} testId="maintenance-page" />;
  }
  const ta = user.impersonatedBy ? await getTranslations("admin") : null;
  return (
    <IntlProvider>
    {ta && (
      <form action={endImpersonationAction} className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-3 bg-[#B54708] px-4 py-2 text-sm text-white print:hidden" data-testid="impersonation-banner">
        <span>{ta("imp.banner", { name: user.name, email: user.email })}</span>
        <button className="min-h-11 rounded-full bg-white px-4 font-medium text-[#B54708]" data-testid="impersonation-end">{ta("imp.end")}</button>
      </form>
    )}
    {ann && <AnnouncementBar {...ann} />}
    <div className="min-h-dvh bg-paper pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0 print:min-h-0 print:bg-white print:pb-0">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/80 pt-[env(safe-area-inset-top)] backdrop-blur-md print:hidden">
        <div className="flex h-16 items-center gap-2 ps-[max(1rem,env(safe-area-inset-left))] pe-[max(1rem,env(safe-area-inset-right))] md:px-6">
          {stores.length > 1 ? (
            <>
              <Link href="/dashboard" className="flex min-h-11 shrink-0 items-center" aria-label="Reelcart"><Awning className="h-3.5 w-9 shrink-0" /></Link>
              <StoreSwitcher
                current={{ id: store.id, name: store.name, slug: store.slug, role }}
                stores={stores.map((a) => ({ id: a.store.id, name: a.store.name, slug: a.store.slug, role: a.role }))}
                labels={{ switch: t("switchStore"), manage: t("manageStores"), staff: t("staffBadge") }}
              />
            </>
          ) : (
            <Link href="/dashboard" className="me-auto flex min-h-11 min-w-0 items-center gap-3" aria-label={`Reelcart · ${store.name}`}>
              <Awning className="h-3.5 w-9 shrink-0" />
              <span className="truncate text-[15px] font-medium text-ink">{store.name}</span>
            </Link>
          )}
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
            <DashNav variant="side" newOrders={newOrders} role={role} />
          </div>
          <form action={logOutAction} className="border-t border-line pt-3">
            <PendingButton className="flex min-h-11 w-full items-center rounded-lg px-3 text-[14px] text-ink/60 transition-colors duration-150 hover:bg-ink/[0.04] hover:text-ink">{tc("logout")}</PendingButton>
          </form>
        </aside>
        <main className="mx-auto w-full min-w-0 max-w-[72rem] px-4 py-6 sm:px-6 md:px-10 md:py-10 print:max-w-none print:p-0">{!verified && <VerifyEmailBanner />}{children}</main>
      </div>
      <DashNav variant="bottom" newOrders={newOrders} role={role} />
      <CommandPalette />
    </div>
    </IntlProvider>
  );
}
