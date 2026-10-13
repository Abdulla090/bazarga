import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { PricingPlans } from "@/components/pricing/PricingPlans";
import { StickyFreeCta } from "@/components/pricing/StickyFreeCta";
import { SiteFooter } from "@/components/SiteFooter";
import { WaitlistForm } from "./WaitlistForm";
import { IRAQI_CITIES } from "@/lib/cities";
import { formatIQD } from "@/lib/money";
import { isLocale, pickText, DEFAULT_LOCALE } from "@/lib/i18n";
import { ArrowForward, Droplet, Icon, Scissors, Shirt, Smartphone, Sparkles } from "@/components/ui/icons";
import { HeroVisual } from "@/components/marketing/HeroVisual";
import { HeroCta, HeroHook } from "@/components/marketing/HeroCta";

const DEMO_SLUG = "hawler-bazaar";

const SHIRT = { img: "product-shirt", price: 85000, name: { ku: "کراسی کەتان", ar: "قميص كتان", en: "Linen overshirt" } };
/** Demo tiles use the pre-built pipeline WebP renditions (public/images/seed, 320–1024 w) via srcset. */
const seedSrc = (base: string, w: number) => `/images/seed/${base}-${w}.webp`;
const seedSrcSet = (base: string) => [320, 480, 640, 1024].map((w) => `${seedSrc(base, w)} ${w}w`).join(", ");
const DEMO_SIZES = "(min-width: 1152px) 360px, (min-width: 640px) calc(33vw - 24px), calc(50vw - 22px)";
const DEMO = [
  SHIRT,
  { img: "product-mugs", price: 25000, name: { ku: "سێتی کوپی گڵ · 2 دانە", ar: "طقم أكواب فخارية · قطعتان", en: "Stoneware mug set · 2 pcs" } },
  { img: "product-skincare", price: 40000, name: { ku: "سێتی پێستی سروشتی", ar: "مجموعة عناية طبيعية بالبشرة", en: "Natural skincare set" } },
];

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const tc = await getTranslations("common");
  const tp = await getTranslations("pricing");
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const steps = [
    { who: t("you"), title: t("s1Title"), body: t("s1Body") },
    { who: t("we"), title: t("s2Title"), body: t("s2Body") },
    { who: t("you"), title: t("s3Title"), body: t("s3Body") },
  ];
  const why = [
    { icon: "ک", title: t("w1Title"), body: t("w1Body") },
    { icon: "0", title: t("w2Title"), body: t("w2Body") },
    { icon: "IQD", title: t("w3Title"), body: t("w3Body") },
    { icon: "∞", title: t("w4Title"), body: t("w4Body") },
  ];
  const who = [
    [Shirt, t("c1")],
    [Sparkles, t("c2")],
    [Droplet, t("c3")],
    [Scissors, t("c4")],
    [Smartphone, t("c5")],
  ] as const;

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only">{tc("skipToContent")}</a>
      <SiteHeader />
      <main id="main">
        {/* Hero: centred and tight, minimal $1 | Try Pro pill as the eyebrow (full terms live on /pricing), two CTAs + free micro-line, then the product story as a picture (HeroVisual)
            rising into the first viewport: chat photos + price -> a real store -> an order. */}
        <section className="hero-stage">
          <div className="container-page flex flex-col items-center pt-7 text-center sm:pt-12">
            <Link href="/pricing" data-hero-promo className="promo-eyebrow hero-rise group inline-flex min-h-11 max-w-full items-center gap-2.5 rounded-full ps-3.5 pe-3 text-start">
              <span className="sr-only">{tp("wasNow")}</span>
              <span aria-hidden="true" dir="ltr" className="promo-num text-xl font-bold">$1</span>
              <span aria-hidden="true" className="h-4 w-px shrink-0 bg-[#2563EB]/25" />
              <span className="whitespace-nowrap text-sm font-semibold tracking-tight text-ink">{t("hookLabel")}</span>
              <ArrowForward className="text-base text-[#2563EB] transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
            </Link>
            <h1 className="hero-rise hero-d1 mt-4 max-w-4xl text-[2.5rem] font-light leading-[1.1] tracking-tight text-balance sm:mt-5 sm:text-6xl lg:text-[4.5rem] lg:leading-[1.04]">
              <span className="block">{t("heroTitle1")}</span>
              <span className="block"><HeroHook text={t("heroTitle2")} /></span>
            </h1>
            <p className="hero-rise hero-d2 mt-4 hidden max-w-xl text-ink-70 text-pretty sm:block sm:text-lg">{t("heroLead")}</p>
            <div className="hero-rise hero-d3 mt-6 flex w-full flex-col items-stretch justify-center gap-3 sm:mt-7 sm:w-auto sm:flex-row sm:items-center">
              <HeroCta href="/signup" label={tp("cta")} />
              <Link href={`/s/${DEMO_SLUG}`} className="btn-ghost min-h-12 px-7 text-base">{t("heroCta2")}</Link>
            </div>
            <p data-hero-note className="hero-rise hero-d3 mt-3 text-sm text-ink-50">{t("heroNote")}</p>
            <div data-hero-phone className="hero-rise hero-d4 mt-10 w-full sm:mt-[5.5rem]">
              <HeroVisual locale={locale} />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 bg-white py-14">
          <div className="container-page">
            <p className="eyebrow">{t("howEyebrow")}</p>
            <h2 className="mt-2 text-3xl font-extrabold">{t("howTitle")}</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {steps.map((s, i) => (
                <li key={i} className="card bg-paper">
                  <div className="flex items-center gap-3">
                    <span className="num text-3xl font-extrabold text-gold">0{i + 1}</span>
                    <span className="chip bg-ink text-paper">{s.who}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                  <p className="mt-1 text-ink-70">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Demo */}
        <section className="container-page py-14">
          <p className="eyebrow">{t("demoEyebrow")}</p>
          <h2 className="mt-2 text-3xl font-extrabold">{t("demoTitle")}</h2>
          <p className="mt-3 max-w-prose text-ink-70">{t("demoBody")}</p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {DEMO.map((p) => (
              <Link key={p.img} href={`/s/${DEMO_SLUG}`} className="group overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={seedSrc(p.img, 640)} srcSet={seedSrcSet(p.img)} sizes={DEMO_SIZES} width={1024} height={1024} alt={pickText(p.name, locale)} className="aspect-square h-auto w-full object-cover transition group-hover:scale-[1.02]" loading="lazy" decoding="async" />
                <div className="p-3">
                  <p className="font-bold">{pickText(p.name, locale)}</p>
                  <p className="num text-ink-70">{formatIQD(p.price, locale)}</p>
                </div>
              </Link>
            ))}
          </div>
          <Link href={`/s/${DEMO_SLUG}`} className="btn-ink mt-6">{t("demoCta")}</Link>
        </section>

        {/* Why */}
        <section className="bg-ink py-14 text-paper">
          <div className="container-page">
            <p className="text-sm font-bold uppercase tracking-wide text-gold">{t("whyEyebrow")}</p>
            <h2 className="mt-2 text-3xl font-extrabold">{t("whyTitle")}</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {why.map((w) => (
                <div key={w.title} className="rounded-[var(--radius-card)] border border-white/10 bg-white/5 p-5">
                  <span className="num inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-gold px-2 font-extrabold text-on-gold">{w.icon}</span>
                  <h3 className="mt-3 text-lg font-bold">{w.title}</h3>
                  <p className="mt-1 text-paper/75">{w.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who */}
        <section className="container-page py-14">
          <p className="eyebrow">{t("whoEyebrow")}</p>
          <h2 className="mt-2 text-3xl font-extrabold">{t("whoTitle")}</h2>
          <ul className="mt-6 flex flex-wrap gap-3">
            {who.map(([icon, label]) => (
              <li key={label} className="card flex items-center gap-2 px-4 py-3 font-semibold">
                <Icon as={icon} className="text-2xl text-green" /> {label}
              </li>
            ))}
          </ul>
        </section>

        {/* Pricing */}
        <section id="pricing" className="container-page scroll-mt-20 py-14">
          <h2 className="text-3xl font-light sm:text-4xl">{tp("title")}</h2>
          <p className="mt-2 mb-8 max-w-xl text-ink-70">{tp("lead")}</p>
          <PricingPlans />
        </section>

        {/* Waitlist */}
        <section id="join" className="scroll-mt-20 bg-white py-14">
          <div className="container-page max-w-2xl">
            <p className="eyebrow">{t("joinEyebrow")}</p>
            <h2 className="mt-2 mb-6 text-3xl font-extrabold">{t("joinTitle")}</h2>
            <WaitlistForm cities={IRAQI_CITIES.map((c) => ({ key: c.key, name: pickText(c.name, locale) }))} />
          </div>
        </section>
      </main>
      <SiteFooter />
      <StickyFreeCta />
    </>
  );
}
