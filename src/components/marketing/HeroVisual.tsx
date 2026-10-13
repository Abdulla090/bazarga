import { getTranslations } from "next-intl/server";
import { formatIQD } from "@/lib/money";
import { pickText, type Locale } from "@/lib/i18n";
import { HeroReveal } from "./HeroReveal";
import { Banknote, Bell, Check, Icon, ImageIcon, ShoppingBag, Whatsapp } from "@/components/ui/icons";

/**
 * Hero visual: "your WhatsApp / Instagram photos + prices → a real store → orders", in one glance.
 * Start side: the seller's chat message (3 photos + a price) with a curved connector into the phone.
 * Centre: a phone showing the real demo store (hawler-bazaar seed products and images).
 * End side: a "New order" notification and the payment chip.
 * Pure HTML/CSS/SVG plus one tiny client island (HeroReveal): the floating cards stay invisible until the first
 * scroll, then blur in one after the other and settle fully sharp. CSP-safe (no inline script). Positions use logical insets, so RTL mirrors the story for free.
 * Seed images are already resized WebP renditions; plain <img srcset> on purpose (same reason as ResponsiveImage).
 */

type Text = Partial<Record<Locale, string>> & { en: string };
const P = {
  shirt: { base: "product-shirt-full", price: 85000, name: { ku: "کراسی کەتان", ar: "قميص كتان", en: "Linen overshirt", kmr: "Kirasê ketan" } as Text },
  mugs: { base: "product-mugs", price: 25000, name: { ku: "سێتی کوپی گڵ · 2 دانە", ar: "طقم أكواب فخارية · 2", en: "Stoneware mug set", kmr: "Seta kûpên axî" } as Text },
  skin: { base: "product-skincare", price: 40000, name: { ku: "سێتی پێستی سروشتی", ar: "مجموعة عناية طبيعية", en: "Natural skincare set", kmr: "Seta çermê xwezayî" } as Text },
};
const src = (base: string, w: number) => `/images/seed/${base}-${w}.webp`;
const srcSet = (base: string) => `${src(base, 320)} 320w, ${src(base, 480)} 480w, ${src(base, 640)} 640w`;

function Thumb({ base, className }: { base: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- pre-resized seed rendition
  return <img src={src(base, 320)} alt="" width={320} height={320} decoding="async" className={className} />;
}

export async function HeroVisual({ locale }: { locale: Locale }) {
  const t = await getTranslations("landing");
  const price = formatIQD(P.mugs.price, locale);
  return (
    <div className="hv relative mx-auto w-full max-w-5xl" role="img" aria-label={t("hvAria")} data-hv data-reveal="off">
      <HeroReveal />
      {/* No JS: never leave the cards hidden. */}
      <noscript dangerouslySetInnerHTML={{ __html: "<style>[data-hv] .hv-reveal,[data-hv] .hv-reveal-fade{opacity:1!important;visibility:visible!important;filter:none!important;transform:none!important}</style>" }} />
      <div aria-hidden="true" className="relative mx-auto h-[26rem] sm:h-[34rem]">
        {/* Connector: chat card → phone (desktop only). Mirrored in RTL. */}
        <svg className="hv-wire hv-reveal-fade pointer-events-none absolute end-[calc(50%+8.4rem)] top-[5.5rem] hidden h-28 w-[4.75rem] lg:block rtl:-scale-x-100" viewBox="0 0 76 112" fill="none">
          <path d="M2 8 C 44 8, 30 102, 70 102" stroke="url(#hvw)" strokeWidth="2" strokeLinecap="round" className="hv-dash" />
          <circle cx="71" cy="102" r="3.5" fill="#2563EB" />
          <defs>
            <linearGradient id="hvw" x1="0" y1="0" x2="76" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#2563EB" stopOpacity=".25" />
              <stop offset="1" stopColor="#2563EB" />
            </linearGradient>
          </defs>
        </svg>
        <svg className="hv-wire hv-reveal-fade hv-rv-1 pointer-events-none absolute start-[calc(50%+8.4rem)] top-[8rem] hidden h-24 w-[4.75rem] lg:block rtl:-scale-x-100" viewBox="0 0 76 96" fill="none">
          <path d="M5 86 C 44 86, 32 10, 74 10" stroke="url(#hvw2)" strokeWidth="2" strokeLinecap="round" className="hv-dash" />
          <circle cx="5" cy="86" r="3.5" fill="#2563EB" />
          <defs>
            <linearGradient id="hvw2" x1="0" y1="0" x2="76" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#2563EB" />
              <stop offset="1" stopColor="#2563EB" stopOpacity=".25" />
            </linearGradient>
          </defs>
        </svg>

        {/* Phone */}
        <div className="hv-par-phone absolute inset-x-0 top-4 mx-auto w-[13.25rem] sm:w-[17.5rem]">
          <span className="hv-step-pill absolute -top-3.5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#2563EB] px-3 py-1 text-[11px] font-semibold text-white sm:text-xs">
            <span className="num">2</span>
            <span aria-hidden="true" className="h-3 w-px bg-white/40" />
            {t("hvStep2")}
          </span>
          <div className="hv-phone rounded-[2.4rem] bg-ink p-[7px] sm:rounded-[2.9rem] sm:p-[9px]">
            <div className="relative overflow-hidden rounded-[2rem] bg-white text-start sm:rounded-[2.4rem]">
              <div className="flex h-7 items-center justify-center sm:h-8"><span className="h-4 w-16 rounded-full bg-ink sm:w-20" /></div>
              <div className="flex items-center gap-2 px-3 pb-2 sm:px-4">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-paper sm:h-8 sm:w-8">SH</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold leading-tight sm:text-sm">Studio Hawler</span>
                  <span dir="ltr" className="num block truncate text-[10px] leading-tight text-ink-50 sm:text-[11px]">/s/hawler-bazaar</span>
                </span>
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-ink sm:h-8 sm:w-8"><Icon as={ShoppingBag} size="0.95em" /></span>
              </div>
              <div className="px-2.5 sm:px-3">
                <div className="overflow-hidden rounded-2xl bg-paper">
                  {/* eslint-disable-next-line @next/next/no-img-element -- pre-resized seed rendition */}
                  <img src={src(P.shirt.base, 480)} srcSet={srcSet(P.shirt.base)} sizes="(min-width: 640px) 264px, 200px" alt="" width={480} height={480} decoding="async" fetchPriority="high" className="aspect-[5/4] w-full object-cover" />
                </div>
                <div className="flex items-end justify-between gap-2 px-1 pt-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold sm:text-sm">{pickText(P.shirt.name, locale)}</span>
                    <span className="num block text-[11px] text-ink-70 sm:text-xs">{formatIQD(P.shirt.price, locale)}</span>
                  </span>
                  <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-ink px-3 text-[11px] font-semibold text-paper sm:h-8 sm:text-xs">{t("mockOrder")}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 pb-4">
                  {[P.mugs, P.skin].map((p) => (
                    <div key={p.base} className="overflow-hidden rounded-xl border border-line">
                      <Thumb base={p.base} className="aspect-square w-full object-cover" />
                      <div className="p-1.5 sm:p-2">
                        <p className="truncate text-[10px] font-semibold sm:text-[11px]">{pickText(p.name, locale)}</p>
                        <p className="num truncate text-[10px] text-ink-70 sm:text-[11px]">{formatIQD(p.price, locale)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Start side: the seller's chat message */}
        <div className="hv-par-a absolute start-0 top-[7.5rem] z-20 sm:top-28 lg:top-14 lg:start-auto lg:end-[calc(50%+12.75rem)]">
          <div className="hv-reveal" data-reveal-card="chat">
          <div className="hv-card hv-float w-[9.75rem] p-2 text-start sm:w-60 sm:p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-ink-50 sm:text-xs">
              <span className="num inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#2563EB] text-[9px] text-white sm:h-5 sm:w-5 sm:text-[10px]">1</span>
              {t("hvStep1")}
            </p>
            <div className="hv-bubble mt-1.5 rounded-2xl rounded-ss-md p-1.5 sm:mt-2 sm:p-2">
              <div className="grid grid-cols-3 gap-1">
                {[P.shirt.base, P.mugs.base, P.skin.base].map((b) => (
                  <Thumb key={b} base={b} className="aspect-square w-full rounded-lg object-cover" />
                ))}
              </div>
              <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-ink sm:text-xs">
                <Icon as={ImageIcon} size="1.1em" className="text-ink-50" />
                <span className="num truncate">{t("hvChatCaption", { count: 3, price })}</span>
              </p>
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-[10px] text-ink-50 sm:text-[11px]">
              <Icon as={Whatsapp} size="1.15em" className="text-[#2563EB]" />
              <span className="truncate">{t("hvChatFrom")}</span>
            </p>
          </div>
          </div>
        </div>

        {/* End side: the order that comes in, then how it gets paid */}
        <div className="hv-par-b absolute end-0 top-[15.5rem] z-20 sm:top-64 lg:top-[8.5rem] lg:end-auto lg:start-[calc(50%+12.75rem)]">
          <div className="hv-reveal hv-rv-1" data-reveal-card="order">
          <div className="hv-card hv-float hv-float-2 w-[10.25rem] p-2 text-start sm:w-64 sm:p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-ink-50 sm:text-xs">
              <span className="num inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#2563EB] text-[9px] text-white sm:h-5 sm:w-5 sm:text-[10px]">3</span>
              {t("hvStep3")}
            </p>
            <div className="mt-1.5 flex items-center gap-2 sm:mt-2 sm:gap-3">
              <span className="hv-ping relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white sm:h-10 sm:w-10">
                <Icon as={Bell} size="1.05em" />
              </span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-1.5">
                  <span className="truncate text-[11px] font-bold sm:text-sm">{t("hvOrderTitle")}</span>
                  <span className="shrink-0 text-[9px] text-ink-50 sm:text-[11px]">{t("hvNow")}</span>
                </span>
                <span className="num block truncate text-[10px] text-ink-70 sm:text-xs">{t("hvOrderMeta", { price })}</span>
              </span>
            </div>
          </div>
          <span className="hv-chip hv-float hv-float-3 ms-3 mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-ink sm:ms-6 sm:mt-3 sm:px-3 sm:py-1.5 sm:text-xs">
            <Icon as={Banknote} size="1.1em" className="text-[#2563EB]" />
            {t("hvPay")}
          </span>
          </div>
        </div>

        {/* Lower start side: the store is live (desktop) */}
        <span className="hv-reveal hv-rv-2 absolute top-[17.5rem] z-20 hidden lg:block lg:end-[calc(50%+13.5rem)]">
          <span className="hv-chip hv-float hv-float-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold">
            <Icon as={Check} className="text-[#2563EB]" /> {t("badge")}
          </span>
        </span>
      </div>
    </div>
  );
}
