import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { logOutAction } from "@/server/actions/auth";
import { Logo } from "@/components/Logo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { IntlProvider } from "@/components/IntlProvider";
import { currentLocale } from "@/server/locale";
import { DashNav } from "@/components/dashboard/DashNav";
import { ExternalLink, Icon } from "@/components/ui/icons";

export const metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { store } = await requireStore();
  const t = await getTranslations("dash");
  const tc = await getTranslations("common");
  const locale = await currentLocale();
  return (
    <IntlProvider>
    <div className="min-h-dvh pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center gap-2 ps-[max(1rem,env(safe-area-inset-left))] pe-[max(1rem,env(safe-area-inset-right))]">
          <Link href="/dashboard" className="me-auto flex min-h-11 min-w-0 items-center gap-3">
            <Logo showKu={false} />
            <span className="hidden truncate text-sm font-bold text-ink-70 sm:inline">· {store.name}</span>
          </Link>
          <LocaleSwitcher current={locale} compact />
          <Link href={`/s/${store.slug}`} target="_blank" className="btn-ghost btn-sm">{t("viewStore")} <Icon as={ExternalLink} className="rtl:-scale-x-100" /></Link>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="sticky top-20 hidden h-fit w-56 shrink-0 md:block">
          <DashNav variant="side" />
          <form action={logOutAction} className="mt-6">
            <button className="btn-ghost btn-sm w-full">{tc("logout")}</button>
          </form>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <DashNav variant="bottom" />
    </div>
    </IntlProvider>
  );
}
