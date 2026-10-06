import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "./Logo";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { currentUser } from "@/server/auth/session";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const user = await currentUser().catch(() => null);
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur">
      <div className="container-page flex min-h-16 flex-wrap items-center gap-3 py-2">
        <Link href="/" className="me-auto">
          <Logo />
        </Link>
        <LocaleSwitcher locales={["ku", "ar", "en"]} />
        {user ? (
          <Link href="/dashboard" className="btn-gold btn-sm">
            {t("dashboard")}
          </Link>
        ) : (
          <>
            <Link href="/login" className="btn-ghost btn-sm hidden sm:inline-flex">
              {t("login")}
            </Link>
            <Link href="/signup" className="btn-gold btn-sm">
              {t("cta")}
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
