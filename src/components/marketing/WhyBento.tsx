import type { Locale } from "@/lib/i18n";
import { pickText } from "@/lib/i18n";
import { formatIQD } from "@/lib/money";
import { IRAQ_GOVERNORATES } from "@/lib/governorates";
import { Icon, Sparkles } from "@/components/ui/icons";
import { BentoSpotlight } from "./BentoSpotlight";
import { TypeMorph, type MorphPhrase } from "./TypeMorph";
import { rv, Words } from "./reveal";

export type WhyLabels = {
  eyebrow: string;
  title: string;
  lead: string;
  w1Title: string;
  w1Body: string;
  w2Title: string;
  w2Body: string;
  w3Title: string;
  w3Body: string;
  chatName: string;
  chatMsg: string;
  cardBadge: string;
  cardCta: string;
  payLabel: string;
  soon: string;
  deliveryLabel: string;
  productName: string;
  /** Accessible name for the demo's language dropdown. */
  langPick?: string;
};

/** The same promise in each language the store speaks; the page's own locale goes first. */
const PHRASES: Record<"ku" | "kmr" | "ar" | "en", MorphPhrase> = {
  ku: {
    lang: "ckb",
    dir: "rtl",
    label: "سۆرانی",
    text: "فرۆشگاکەت، بە زمانی خۆت.",
  },
  kmr: {
    lang: "kmr",
    dir: "ltr",
    label: "Kurmancî",
    text: "Firoşgeha te, bi zimanê te.",
  },
  ar: { lang: "ar", dir: "rtl", label: "العربية", text: "متجرك، بلغتك أنت." },
  en: {
    lang: "en",
    dir: "ltr",
    label: "English",
    text: "Your store, in your language.",
  },
};
const ORDER = ["ku", "kmr", "ar", "en"] as const;

const PAY = [
  { id: "cod", label: "COD" },
  { id: "fib", label: "FIB" },
  { id: "zaincash", label: "ZainCash" },
  { id: "fastpay", label: "FastPay", soon: true },
  { id: "qi", label: "Qi Card", soon: true },
];
const TICKER_CITIES = [
  "erbil",
  "sulaymaniyah",
  "duhok",
  "kirkuk",
  "baghdad",
  "basra",
];

const seed = (b: string) => `/images/seed/${b}-320.webp`;

/**
 * "Why Bazarga" bento (agentb/why-faq): light band (Oct 18: was ink), three uneven tiles, each with a live mini-visual instead of an
 * icon. All motion is CSS (marketing.css) except two small islands: TypeMorph (typewriter) and BentoSpotlight (cursor
 * ring). Reveal: one-time card rise via RevealObserver (data-rv), visible without JS.
 */
export function WhyBento({ locale, l }: { locale: Locale; l: WhyLabels }) {
  const first = (ORDER as readonly string[]).includes(locale)
    ? (locale as (typeof ORDER)[number])
    : "en";
  const phrases = [first, ...ORDER.filter((k) => k !== first)].map(
    (k) => PHRASES[k],
  );
  const gov = new Map<string, (typeof IRAQ_GOVERNORATES)[number]>(
    IRAQ_GOVERNORATES.map((g) => [g.key, g]),
  );
  const ticker = TICKER_CITIES.map((k) => gov.get(k)).filter(
    (g): g is NonNullable<typeof g> => Boolean(g),
  );
  const tickerLoop = ticker.length ? [...ticker, ticker[0]!] : [];

  return (
    <section className="why-band" aria-labelledby="why-title">
      <div className="container-page relative">
        <div className="max-w-2xl">
          <p className="mk-eyebrow" {...rv("e")}>{l.eyebrow}</p>
          <h2
            id="why-title"
            className="mt-3 text-[2rem] font-light leading-[1.1] tracking-tight text-balance sm:text-5xl"
            {...rv("h", 60)}
          >
            <Words text={l.title} />
          </h2>
          <p className="mt-4 max-w-xl text-pretty text-ink-70 sm:text-lg" {...rv("t", 240)}>
            {l.lead}
          </p>
        </div>

        <div data-bento className="bento mt-10 sm:mt-14">
          <BentoSpotlight />

          {/* 1 · Kurdish-first: typewriter morph */}
          <article className="bento-tile bento-a" {...rv("c", 100)}>
            <div className="bento-copy">
              <h3 className="bento-title">{l.w1Title}</h3>
              <p className="bento-body">{l.w1Body}</p>
            </div>
            <div className="bento-vis bento-vis-a">
              <TypeMorph phrases={phrases} label={l.langPick} />
            </div>
          </article>

          {/* 2 · Zero setup: chat photos → product card */}
          <article className="bento-tile bento-b" {...rv("c", 220)}>
            <div className="bento-copy">
              <h3 className="bento-title">{l.w2Title}</h3>
              <p className="bento-body">{l.w2Body}</p>
            </div>
            <div className="bento-vis" aria-hidden="true">
              <div className="zs">
                <div className="zs-head">
                  <span className="zs-avatar" />
                  <span className="zs-name">{l.chatName}</span>
                </div>
                <div className="zs-thread">
                  <div className="zs-bubble zs-photos zs-s1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={seed("product-shirt")}
                      alt=""
                      width={320}
                      height={320}
                      loading="lazy"
                      decoding="async"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={seed("product-mugs")}
                      alt=""
                      width={320}
                      height={320}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="zs-bubble zs-text zs-s2">
                    <span>{l.chatMsg}</span>
                    <span className="num zs-price">
                      {formatIQD(85000, locale)}
                    </span>
                  </div>
                </div>
                <div className="zs-spark zs-s3">
                  <span className="zs-line" />
                  <Icon as={Sparkles} className="text-[15px]" />
                  <span className="zs-line" />
                </div>
                <div className="zs-card zs-s4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={seed("product-shirt")}
                    alt=""
                    width={320}
                    height={320}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="zs-card-body">
                    <span className="zs-badge">
                      <span className="zs-dot" />
                      {l.cardBadge}
                    </span>
                    <span className="zs-card-name">{l.productName}</span>
                    <span className="num zs-card-price">
                      {formatIQD(85000, locale)}
                    </span>
                    <span className="zs-cta">{l.cardCta}</span>
                  </div>
                </div>
              </div>
            </div>
          </article>

          {/* 3 · Local money: payment chips + city price ticker */}
          <article className="bento-tile bento-c" {...rv("c", 340)}>
            <div className="bento-copy">
              <h3 className="bento-title">{l.w3Title}</h3>
              <p className="bento-body">{l.w3Body}</p>
            </div>
            <div className="bento-vis lm" aria-hidden="true">
              <p className="lm-label">{l.payLabel}</p>
              <ul className="lm-chips" dir="ltr">
                {PAY.map((p, i) => (
                  <li
                    key={p.id}
                    className="lm-chip"
                    style={{ "--k": i } as React.CSSProperties}
                  >
                    <span className="lm-chip-dot" />
                    {p.label}
                    {p.soon && <span className="lm-soon">{l.soon}</span>}
                  </li>
                ))}
              </ul>
              <p className="lm-label mt-4">{l.deliveryLabel}</p>
              <div className="lm-ticker">
                <ul className="lm-roll">
                  {tickerLoop.map((g, i) => (
                    <li key={`${g.key}-${i}`} className="lm-row">
                      <span className="lm-city">
                        {pickText(g.name, locale)}
                      </span>
                      <span className="num lm-fee">
                        {formatIQD(g.defaultFee, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>

        </div>
      </div>
    </section>
  );
}
