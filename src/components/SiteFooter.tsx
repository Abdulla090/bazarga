import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "./Logo";

export async function SiteFooter() {
  const t = await getTranslations("landing");
  const p = await getTranslations("pricing");
  const l = await getTranslations("legal");
  return (
    <footer className="border-t border-line py-8">
      <div className="container-page flex flex-wrap items-center justify-between gap-4 text-sm text-ink-70">
        <Logo />
        <Link href="/pricing" className="min-h-11 content-center hover:text-ink">{p("nav")}</Link>
        <nav aria-label={l("footerLabel")} className="flex flex-wrap gap-x-5">
          {(["terms", "privacy", "refunds"] as const).map((k) => (
            <Link key={k} href={`/${k}`} className="min-h-11 content-center hover:text-ink">{l(k)}</Link>
          ))}
        </nav>
        <p>{t("madeIn")} · © {new Date().getFullYear()} Bazarga</p>
      </div>
    </footer>
  );
}
