import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "./Logo";
import { currentLocale } from "@/server/locale";
import { LEGAL_DOCS, LEGAL_PATH, LEGAL_UI } from "@/lib/legal-ui";

export async function SiteFooter() {
  const t = await getTranslations("landing");
  const p = await getTranslations("pricing");
  const sc = await getTranslations("showcase");
  const ui = LEGAL_UI[await currentLocale()];
  return (
    <footer className="border-t border-line py-8" data-testid="site-footer">
      <div className="container-page flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm text-ink-70">
        <Logo />
        <nav aria-label={p("footerNav")} className="flex flex-wrap items-center gap-x-5">
          <Link href="/pricing" className="min-h-11 min-w-11 content-center text-center hover:text-ink">{p("nav")}</Link>
          <Link href="/showcase" className="min-h-11 min-w-11 content-center text-center hover:text-ink">{sc("nav")}</Link>
          {LEGAL_DOCS.map((d) => (
            <Link key={d} href={LEGAL_PATH[d]} className="min-h-11 min-w-11 content-center text-center hover:text-ink">{ui.nav[d]}</Link>
          ))}
        </nav>
        <p>{t("madeIn")} · © {new Date().getFullYear()} Reelcart</p>
      </div>
    </footer>
  );
}
