import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LEGAL_SLUGS, LEGAL_UPDATED, legalDoc, type LegalSlug } from "@/content/legal";
import { currentLocale } from "@/server/locale";

/** Server-only legal page: text lives in src/content/legal (not in client messages, so it adds no JS). */
export async function LegalPage({ slug }: { slug: LegalSlug }) {
  const [locale, t] = await Promise.all([currentLocale(), getTranslations("legal")]);
  const doc = legalDoc(slug, locale);
  const email = (process.env.SUPPORT_EMAIL?.trim() || "founder@kurdistanai.app");
  const phone = (process.env.SUPPORT_WHATSAPP?.trim() || "+9647516695482");
  return (
    <>
      <SiteHeader />
      <main id="main">
        <article className="container-page max-w-3xl py-12 md:py-20" data-legal={slug}>
          <h1 className="text-3xl font-light leading-tight tracking-tight sm:text-5xl">{doc.title}</h1>
          <p className="mt-3 text-sm text-ink-70">
            {t("updated", { date: LEGAL_UPDATED })}
          </p>
          <p className="mt-6 text-lg text-ink-70">{doc.intro}</p>
          {doc.sections.map((s) => (
            <section key={s.h} className="mt-10">
              <h2 className="text-xl font-semibold">{s.h}</h2>
              {s.p.map((para) => (
                <p key={para} className="mt-3 leading-8 text-ink-70">{para}</p>
              ))}
            </section>
          ))}
          <section className="mt-12 rounded-2xl border border-line p-5" data-legal-contact>
            <h2 className="text-xl font-semibold">{t("contactTitle")}</h2>
            <div className="mt-3 grid gap-1 text-ink-70">
              {email && <p>{t("contactEmail", { email: "\u2066" + email + "\u2069" })}</p>}
              {phone && <p>{t("contactWhatsapp", { phone: "\u2066" + phone + "\u2069" })}</p>}
              {!email && !phone && <p>{t("contactFallback")}</p>}
            </div>
          </section>
          <nav aria-label={t("other")} className="mt-10 flex flex-wrap gap-x-6 text-sm">
            {LEGAL_SLUGS.filter((x) => x !== slug).map((x) => (
              <Link key={x} href={`/${x}`} className="inline-flex min-h-11 items-center font-semibold underline">{t(x)}</Link>
            ))}
          </nav>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
