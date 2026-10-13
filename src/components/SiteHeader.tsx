import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "./Logo";
import { LocaleMenu } from "./marketing/LocaleMenu";
import { MobileMenu, type NavLink } from "./marketing/MobileMenu";
import { currentUser } from "@/server/auth/session";
import { currentLocale } from "@/server/locale";
import { UI_LOCALES, type Locale } from "@/lib/i18n";

export type SiteHeaderLabels = {
  how: string; demo: string; pricing: string; login: string; start: string; dashboard: string;
  menu: string; close: string; language: string; main: string;
};

/**
 * Marketing header (/ and /pricing), one row, Linear/Vercel-style: 3-column grid: logo | truly centred links | language · Log in · one CTA (mirrors in RTL).
 * No promo top bar: the hero's "$1 | Try Pro" pill carries the offer, so the header never repeats it.
 * Phones: logo + CTA + menu button only (links, Log in and language live in the sheet). 8px rhythm, hairline bottom.
 */
export function SiteHeaderView({ labels, locale, signedIn }: { labels: SiteHeaderLabels; locale: Locale; signedIn: boolean }) {
  const links: NavLink[] = [
    { href: "/#how", label: labels.how },
    { href: "/s/hawler-bazaar", label: labels.demo },
    { href: "/pricing", label: labels.pricing },
  ];
  const login = signedIn ? undefined : { href: "/login", label: labels.login };
  const cta = signedIn ? { href: "/dashboard", label: labels.dashboard } : { href: "/signup", label: labels.start };
  return (
    <div data-site-top className="sticky top-0 z-40 border-b border-ink/[0.08] bg-paper/85 pt-[env(safe-area-inset-top)] backdrop-blur-md backdrop-saturate-150">
      <header className="container-page flex h-14 items-center gap-2 md:grid md:h-16 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-4">
        <Link href="/" className="me-auto shrink-0 md:me-0 md:justify-self-start" data-nav-logo>
          <Logo showKu="sm" />
        </Link>
        <nav aria-label={labels.main} className="hidden items-center gap-1 md:flex md:justify-self-center" data-nav-links>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="inline-flex h-9 items-center rounded-full px-3 text-sm font-medium whitespace-nowrap text-ink-70 transition-colors hover:bg-ink/[0.04] hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <div data-nav-end className="flex shrink-0 items-center gap-2 md:justify-self-end">
          <div className="hidden md:block">
            <LocaleMenu current={locale} locales={UI_LOCALES} label={labels.language} />
          </div>
          {login && (
            <>
              <span aria-hidden="true" className="mx-1 hidden h-4 w-px bg-ink/10 md:block" />
              <Link href={login.href} data-nav-login className="hidden h-9 items-center px-3 text-sm font-medium whitespace-nowrap text-ink-70 transition-colors hover:text-ink md:inline-flex">
                {login.label}
              </Link>
            </>
          )}
          <Link
            href={cta.href}
            data-nav-cta
            className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-ink px-4 text-sm font-semibold whitespace-nowrap text-paper transition-colors hover:bg-[#2563EB] md:min-h-9"
          >
            {cta.label}
          </Link>
          <MobileMenu links={links} login={login} locale={locale} locales={UI_LOCALES} labels={{ menu: labels.menu, close: labels.close, language: labels.language }} />
        </div>
      </header>
    </div>
  );
}

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const pt = await getTranslations("pricing");
  const user = await currentUser().catch(() => null);
  const locale = await currentLocale();
  return (
    <SiteHeaderView
      locale={locale}
      signedIn={!!user}
      labels={{
        how: t("how"), demo: t("demo"), pricing: pt("nav"), login: t("login"), start: t("start"), dashboard: t("dashboard"),
        menu: t("menu"), close: t("close"), language: t("language"), main: t("main"),
      }}
    />
  );
}
