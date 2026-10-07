import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { Logo } from "@/components/Logo";
import { WaitlistForm } from "./WaitlistForm";
import { IRAQI_CITIES } from "@/lib/cities";
import { formatIQD } from "@/lib/money";
import { isLocale, pickText, DEFAULT_LOCALE } from "@/lib/i18n";
import { Check, Droplet, Icon, Scissors, Shirt, Smartphone, Sparkles } from "@/components/ui/icons";

const DEMO_SLUG = "hawler-bazaar";

const DEMO = [
  { img: "/images/product-dress.jpg", price: 85000, name: { ku: "کراسی کوردی", ar: "فستان كردي", en: "Kurdish dress" } },
  { img: "/images/product-honey.jpg", price: 25000, name: { ku: "هەنگوینی چیا · ١ کیلۆ", ar: "عسل جبلي · 1 كغ", en: "Mountain honey · 1 kg" } },
  { img: "/images/product-cosmetics.jpg", price: 40000, name: { ku: "سێتی پێستی سروشتی", ar: "مجموعة عناية طبيعية بالبشرة", en: "Natural skincare set" } },
];

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const tc = await getTranslations("common");
  const tn = await getTranslations("nav");
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
        {/* Hero */}
        <section className="container-page grid items-center gap-8 py-10 md:grid-cols-2 md:py-16">
          <div>
            <p className="eyebrow">{t("heroEyebrow")}</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight sm:text-5xl">{tc("tagline")}</h1>
            <p className="mt-4 max-w-prose text-lg text-ink-70">{t("heroSub")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className="btn-gold">{tn("cta")}</Link>
              <Link href={`/s/${DEMO_SLUG}`} className="btn-ghost">{t("heroCta2")}</Link>
            </div>
          </div>
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hero.jpg"
              alt={t("heroAlt")}
              width={1200}
              height={900}
              className="aspect-[4/3] w-full rounded-[2rem] object-cover shadow-xl"
              fetchPriority="high"
            />
            <span className="absolute bottom-4 start-4 rounded-full bg-white/95 px-4 py-2 text-sm font-bold shadow">
              <Icon as={Check} className="text-green" /> {t("badge")}
            </span>
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
                  <span className="num inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-gold px-2 font-extrabold text-ink">{w.icon}</span>
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

        {/* Waitlist */}
        <section id="join" className="bg-white py-14">
          <div className="container-page max-w-2xl">
            <p className="eyebrow">{t("joinEyebrow")}</p>
            <h2 className="mt-2 mb-6 text-3xl font-extrabold">{t("joinTitle")}</h2>
            <WaitlistForm cities={IRAQI_CITIES.map((c) => ({ key: c.key, name: pickText(c.name, locale) }))} />
          </div>
        </section>
      </main>
      <footer className="border-t border-line py-8">
        <div className="container-page flex flex-wrap items-center justify-between gap-4 text-sm text-ink-70">
          <Logo />
          <p>{t("madeIn")} · © {new Date().getFullYear()} my market</p>
        </div>
      </footer>
    </>
  );
}
