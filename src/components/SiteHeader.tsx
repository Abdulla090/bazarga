import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "./Logo";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { currentUser } from "@/server/auth/session";
import { AnnouncementBar } from "./pricing/AnnouncementBar";
import { currentLocale } from "@/server/locale";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const user = await currentUser().catch(() => null);
  const pt = await getTranslations("pricing");
  const locale = await currentLocale();
  return (
    /* Bar + header pinned as ONE sticky block: the bar never hides, the header always sits right under it,
       nothing overlaps and nothing shifts. The mobile sticky CTA lives at the bottom edge, so they never meet. */
    <div data-site-top className="sticky top-0 z-40 pt-[env(safe-area-inset-top)] bg-ink">
    <AnnouncementBar />
    <header className="border-b border-line/70 bg-paper">
      <div className="container-page flex min-h-16 flex-wrap items-center gap-3 py-2">
        <Link href="/" className="me-auto">
          <Logo />
        </Link>
        <Link href="/pricing" className="hidden min-h-11 items-center px-2 text-sm font-medium text-ink-70 hover:text-ink sm:inline-flex">{pt("nav")}</Link>
        <div className="sm:hidden"><LocaleSwitcher current={locale} locales={["ku", "ar", "en"]} compact /></div>
        <div className="hidden sm:block"><LocaleSwitcher current={locale} locales={["ku", "ar", "en"]} /></div>
        {user ? (
          <Link href="/dashboard" className="btn-gold btn-sm">
            {t("dashboard")}
          </Link>
        ) : (
          <>
            <Link href="/login" className="btn-ghost btn-sm hidden sm:inline-flex">
              {t("login")}
            </Link>
            {/* Phones: the hero CTA and the bottom sticky CTA carry signup, so the pinned header stays one row. */}
            <Link href="/signup" className="btn-gold btn-sm hidden sm:inline-flex">
              {t("cta")}
            </Link>
          </>
        )}
      </div>
    </header>
    </div>
  );
}
