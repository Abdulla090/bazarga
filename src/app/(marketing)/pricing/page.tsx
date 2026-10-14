import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PricingPlans } from "@/components/pricing/PricingPlans";
import { CompareTable } from "@/components/pricing/CompareTable";

export async function generateMetadata() {
  const t = await getTranslations("pricing");
  return { title: t("nav") };
}

export default async function PricingPage() {
  const t = await getTranslations("pricing");
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="container-page pt-12 pb-8 text-center md:pt-20">
          <p className="mx-auto w-fit rounded-full border border-line px-4 py-1.5 text-sm font-semibold text-[#2563EB]">{t("badge")}</p>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-light leading-tight tracking-tight sm:text-6xl">{t("title")}</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-ink-70">{t("lead")}</p>
        </section>
        <section className="container-page pb-16 xl:max-w-7xl"><PricingPlans /></section>
        <section className="container-page max-w-5xl pb-16">
          <h2 className="mb-6 text-2xl font-light">{t("compare")}</h2>
          <CompareTable />
        </section>
        <section className="container-page max-w-3xl pb-16">
          <h2 className="mb-6 text-2xl font-light">{t("faqTitle")}</h2>
          <dl className="divide-y divide-line border-y border-line">
            {(["q1", "q2", "q3", "q4", "q5"] as const).map((k) => (
              <div key={k} className="py-5">
                <dt className="font-semibold">{t(`faq.${k}.q`)}</dt>
                <dd className="mt-1 text-ink-70">{t(`faq.${k}.a`)}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="bg-ink py-16 text-center text-paper">
          <div className="container-page">
            <h2 className="mx-auto max-w-2xl text-3xl font-light sm:text-5xl">{t("finalTitle")}</h2>
            <Link href="/signup" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-[#2563EB] px-8 font-semibold text-white">{t("finalCta")}</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
