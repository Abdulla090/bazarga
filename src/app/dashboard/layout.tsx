import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { logOutAction } from "@/server/actions/auth";
import { Logo } from "@/components/Logo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { DashNav } from "@/components/dashboard/DashNav";

export const metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { store } = await requireStore();
  const t = await getTranslations("dash");
  const tc = await getTranslations("common");
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center gap-2 px-4">
          <Link href="/dashboard" className="me-auto flex items-center gap-3">
            <Logo showKu={false} />
            <span className="hidden truncate text-sm font-bold text-ink-70 sm:inline">· {store.name}</span>
          </Link>
          <LocaleSwitcher compact />
          <Link href={`/s/${store.slug}`} target="_blank" className="btn-ghost btn-sm">{t("viewStore")} ↗</Link>
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
  );
}
