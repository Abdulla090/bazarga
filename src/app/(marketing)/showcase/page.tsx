import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ShowcaseCard } from "@/components/marketing/ShowcaseCard";
import { getShowcaseStores } from "@/server/cache/showcase";
import { currentLocale } from "@/server/locale";
import { pickText } from "@/lib/i18n";
import { IRAQI_CITIES } from "@/lib/cities";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("showcase");
  return { title: t("metaTitle"), description: t("lead"), alternates: { canonical: "/showcase" } };
}

/** Public seller showcase (docs/DEMAND.md D4): only stores that opted in; the empty state is an honest invitation, never fake stores. */
export default async function ShowcasePage() {
  const t = await getTranslations("showcase");
  const tc = await getTranslations("common");
  const locale = await currentLocale();
  const stores = await getShowcaseStores();
  const cityName = (key: string | null) => {
    const c = IRAQI_CITIES.find((x) => x.key === key);
    return c ? pickText(c.name, locale) : "";
  };
  const labels = { products: t("products"), demo: t("demo"), visit: t("visit"), founding: t("founding") };
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only">{tc("skipToContent")}</a>
      <SiteHeader />
      <main id="main">
        <section className="container-page pt-12 pb-8 md:pt-20">
          <p className="mk-eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-light leading-tight tracking-tight text-balance sm:text-6xl">{t("title")}</h1>
          <p className="mt-4 max-w-xl text-lg text-ink-70">{t("lead")}</p>
        </section>
        {stores.length > 0 ? (
          <section className="container-page pb-16" aria-label={t("title")}>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="showcase-grid">
              {stores.map((s, i) => (
                <li key={s.slug} className="grid">
                  <ShowcaseCard store={s} tagline={pickText(s.tagline, locale)} city={cityName(s.city)} l={labels} priority={i < 2} />
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="container-page pb-16">
            <div className="rounded-2xl border border-line p-8 text-center sm:p-12" data-testid="showcase-empty">
              <h2 className="mx-auto max-w-lg text-2xl font-light sm:text-3xl">{t("emptyTitle")}</h2>
              <p className="mx-auto mt-3 max-w-md text-ink-70">{t("emptyBody")}</p>
              <Link href="/signup" className="btn-gold mt-6">{t("emptyCta")}</Link>
            </div>
          </section>
        )}
        <section className="bg-ink py-16 text-center text-paper">
          <div className="container-page">
            <h2 className="mx-auto max-w-2xl text-3xl font-light sm:text-4xl">{t("ctaTitle")}</h2>
            <p className="mx-auto mt-3 max-w-md text-paper/70">{t("ctaBody")}</p>
            <Link href="/signup" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-[#2563EB] px-8 font-semibold text-white">{t("ctaButton")}</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
