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
import { Check, Droplet, Icon, Scissors, Shirt, ShoppingBag, Smartphone, Sparkles } from "@/components/ui/icons";

const DEMO_SLUG = "hawler-bazaar";

const SHIRT = { img: "/images/product-shirt.jpg", price: 85000, name: { ku: "کراسی کەتان", ar: "قميص كتان", en: "Linen overshirt" } };
const DEMO = [
  SHIRT,
  { img: "/images/product-mugs.jpg", price: 25000, name: { ku: "سێتی کوپی گڵ · ٢ دانە", ar: "طقم أكواب فخارية · قطعتان", en: "Stoneware mug set · 2 pcs" } },
  { img: "/images/product-skincare.jpg", price: 40000, name: { ku: "سێتی پێستی سروشتی", ar: "مجموعة عناية طبيعية بالبشرة", en: "Natural skincare set" } },
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
        {/* Hero: centred, start-free first, $1 Pro hook second, storefront mockup to close the fold. */}
        <section className="hero-stage">
          <div className="container-page flex flex-col items-center pt-10 pb-16 text-center sm:pt-16 md:pb-24">
            <p className="hero-rise inline-flex min-h-9 items-center gap-2 rounded-full border border-[#2563EB]/25 bg-white/80 px-4 text-sm font-semibold text-[#2563EB] shadow-[var(--shadow-e1)]">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
              {tp("badge")}
            </p>
            <h1 className="hero-rise hero-d1 mt-6 max-w-5xl text-[2.6rem] font-light leading-[1.08] tracking-tight text-balance sm:text-6xl lg:text-[5.25rem]">
              <span className="block">{t("heroTitle1")}</span>
              <span className="block text-ink-50">{t("heroTitle2")}</span>
            </h1>
            <p className="hero-rise hero-d2 mt-6 max-w-2xl text-lg text-ink-70 text-pretty sm:text-xl">{t("heroLead")}</p>
            <div className="hero-rise hero-d3 mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Link href="/signup" className="btn-gold min-h-12 px-7 text-base">{tp("cta")}</Link>
              <Link href={`/s/${DEMO_SLUG}`} className="btn-ghost min-h-12 px-7 text-base">{t("heroCta2")}</Link>
            </div>
            <p className="hero-rise hero-d3 mt-3 text-sm text-ink-50">{t("heroNote")}</p>

            <Link href="/pricing" className="hook-ticket hero-rise hero-d4 mt-8 inline-flex min-h-11 max-w-full items-center gap-5 rounded-2xl px-6 py-4 text-start transition-transform duration-200 hover:-translate-y-0.5">
              <span className="sr-only">{tp("wasNow")}</span>
              <span aria-hidden="true" dir="ltr" className="glow-price text-6xl font-semibold sm:text-7xl">$1</span>
              <span aria-hidden="true" className="h-12 w-px shrink-0 bg-line" />
              <span className="flex flex-col">
                <span className="font-semibold text-ink">{t("hookLabel")}</span>
                <span className="text-sm text-ink-70">{t("hookThen")}</span>
              </span>
            </Link>

            {/* Storefront mockup */}
            <div className="hero-rise hero-d5 relative mt-12 w-full max-w-5xl" role="img" aria-label={t("mockAria")}>
              <div className="mock-frame overflow-hidden rounded-[1.75rem] bg-white text-start" aria-hidden="true">
                <div className="flex items-center gap-2 border-b border-line bg-paper px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-line" />
                  <span className="h-2.5 w-2.5 rounded-full bg-line" />
                  <span className="h-2.5 w-2.5 rounded-full bg-line" />
                  <span dir="ltr" className="num mx-auto truncate rounded-full bg-white px-4 py-1 text-xs text-ink-50 ring-1 ring-line">bazarga.vercel.app/s/{DEMO_SLUG}</span>
                </div>
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">{t("mockStore")}</span>
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink text-paper"><Icon as={ShoppingBag} /></span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
                    {DEMO.map((p) => (
                      <div key={p.img} className="overflow-hidden rounded-xl border border-line">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.img} alt="" width={400} height={400} className="aspect-square w-full object-cover" fetchPriority="low" />
                        <div className="p-2 sm:p-3">
                          <p className="hidden truncate text-sm font-semibold sm:block">{pickText(p.name, locale)}</p>
                          <p className="num truncate text-xs text-ink-70 sm:text-sm">{formatIQD(p.price, locale)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Tilted phone (desktop only) */}
              <div className="pointer-events-none absolute -bottom-10 end-4 hidden w-52 lg:block" aria-hidden="true">
                <div className="mock-phone rounded-[2.25rem] bg-ink p-2">
                  <div className="overflow-hidden rounded-[1.8rem] bg-white text-start">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={SHIRT.img} alt="" width={400} height={400} className="aspect-[4/5] w-full object-cover" />
                    <div className="p-3">
                      <p className="truncate text-sm font-semibold">{pickText(SHIRT.name, locale)}</p>
                      <p className="num text-xs text-ink-70">{formatIQD(SHIRT.price, locale)}</p>
                      <span className="mt-2 flex h-9 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper">{t("mockOrder")}</span>
                    </div>
                  </div>
                </div>
              </div>
              <span className="absolute -bottom-4 start-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-[var(--shadow-e3)] ring-1 ring-line sm:start-8">
                <Icon as={Check} className="text-green" /> {t("badge")}
              </span>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="bg-white py-14">
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
                <img src={p.img} alt={pickText(p.name, locale)} className="aspect-square w-full object-cover transition group-hover:scale-[1.02]" loading="lazy" />
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
        <section id="pricing" className="container-page scroll-mt-32 py-14">
          <h2 className="text-3xl font-light sm:text-4xl">{tp("title")}</h2>
          <p className="mt-2 mb-8 max-w-xl text-ink-70">{tp("lead")}</p>
          <PricingPlans />
        </section>

        {/* Waitlist */}
        <section id="join" className="scroll-mt-32 bg-white py-14">
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
