import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LEGAL } from "@/lib/legal";
import { LEGAL_CONTACT, LEGAL_DOCS, LEGAL_PATH, LEGAL_UI, LEGAL_UPDATED_ISO, type LegalDoc } from "@/lib/legal-ui";
import type { Locale } from "@/lib/i18n";

/** /terms, /privacy, /refund: one readable column, a doc switcher, a contents list and numbered sections. Server only. */
export function LegalDocument({ doc, locale }: { doc: LegalDoc; locale: Locale }) {
  const page = LEGAL[doc][locale];
  const ui = LEGAL_UI[locale];
  return (
    <>
      <SiteHeader />
      <main id="main" className="container-page max-w-3xl pb-20 pt-10 sm:pt-16" data-testid={`legal-${doc}`}>
        <nav aria-label={ui.contents} className="mb-10 flex flex-wrap gap-2">
          {LEGAL_DOCS.map((d) => (
            <Link
              key={d}
              href={LEGAL_PATH[d]}
              aria-current={d === doc ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors ${d === doc ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-70 hover:border-ink hover:text-ink"}`}
            >
              {ui.nav[d]}
            </Link>
          ))}
        </nav>
        <header className="border-b border-line pb-8">
          <h1 className="text-balance text-4xl font-light leading-tight tracking-tight sm:text-5xl">{page.title}</h1>
          <p className="mt-3 text-sm text-ink-70">
            {ui.updated}: <time dateTime={LEGAL_UPDATED_ISO}>{ui.date}</time>
          </p>
          <p className="mt-6 text-pretty text-lg leading-relaxed text-ink">{page.intro}</p>
        </header>
        <nav aria-label={ui.contents} className="mt-8 rounded-2xl border border-line bg-white p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-70">{ui.contents}</p>
          <ol className="grid gap-1 sm:grid-cols-2">
            {page.sections.map((s, i) => (
              <li key={s.h}>
                <a href={`#s${i + 1}`} className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm text-ink hover:bg-paper">
                  <span className="num w-6 text-[#2563EB]">{String(i + 1).padStart(2, "0")}</span>
                  <span>{s.h}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="mt-10 grid gap-10">
          {page.sections.map((s, i) => (
            <section key={s.h} id={`s${i + 1}`} className="scroll-mt-24">
              <h2 className="flex items-baseline gap-3 text-xl font-semibold tracking-tight">
                <span className="num text-sm font-medium text-[#2563EB]">{String(i + 1).padStart(2, "0")}</span>
                {s.h}
              </h2>
              {s.p.map((p) => (
                <p key={p.slice(0, 32)} className="mt-3 text-pretty leading-relaxed text-ink-70">{p}</p>
              ))}
            </section>
          ))}
        </div>
        <p className="mt-14 border-t border-line pt-6 text-sm text-ink-70">
          {ui.contact}{" "}
          <a href={`mailto:${LEGAL_CONTACT}`} className="font-medium text-[#2563EB] underline-offset-4 hover:underline" dir="ltr">{LEGAL_CONTACT}</a>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}

export function legalMetadata(doc: LegalDoc, locale: Locale) {
  const p = LEGAL[doc][locale];
  return { title: p.title, description: p.description, alternates: { canonical: LEGAL_PATH[doc] }, openGraph: { title: p.title, description: p.description, url: LEGAL_PATH[doc] } };
}
