import { buildSrcSet } from "@/lib/responsive-image";

type HeroProps = {
  name: string;
  tagline: string;
  cover: { url: string; renditions?: Parameters<typeof buildSrcSet>[0]; placeholder?: string | null } | null;
  shopNow: string;
};

const coverStyle = (c: NonNullable<HeroProps["cover"]>) => (c.placeholder ? { backgroundImage: `url("${c.placeholder}")`, backgroundSize: "cover" } : undefined);

/**
 * Asymmetric hero (Layout v3 §4.1): photo on the inline end bleeding to the viewport edge; the store name starts on
 * the grid's first column and runs over the photo on canvas-coloured plates, so it reads on any photo.
 */
export function HeroSplit({ name, tagline, cover, shopNow }: HeroProps) {
  return (
    <section className="grid-12 -mt-6 items-end sm:-mt-10 md:mt-0" data-testid="store-hero" data-hero="split">
      {cover && (
        <div className="bleed-x col-span-4 overflow-hidden bg-[#F4F4F5] md:col-span-7 md:col-start-6 md:row-start-1 md:ms-0 md:bleed-end md:rounded-s-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover.url}
            srcSet={buildSrcSet(cover.renditions)}
            sizes={cover.renditions?.length ? "(min-width: 768px) 62vw, 100vw" : undefined}
            alt=""
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="aspect-[4/5] w-full object-cover sm:aspect-[4/3] md:aspect-auto md:h-[min(72vh,40rem)]"
            style={coverStyle(cover)}
          />
        </div>
      )}
      <div className={`relative z-[1] col-span-4 grid justify-items-start gap-5 md:gap-7 ${cover ? "-mt-8 md:col-span-8 md:col-start-1 md:row-start-1 md:mt-0 md:self-center md:py-10" : "md:col-span-10 md:py-16"}`}>
        <h1 className="t-hero break-words">
          <span className="hero-plate">{name}</span>
        </h1>
        {tagline && <p className="line-clamp-2 max-w-md text-[17px] leading-snug text-muted md:text-xl">{tagline}</p>}
        <a href="#products" className="btn-gold min-h-12 w-full px-8 sm:w-auto">{shopNow}</a>
      </div>
    </section>
  );
}

/**
 * Editorial masthead: the store name set across the page in display type over a heavy rule, then a two-column
 * spread — tagline and a plain text link on one side, a tall portrait of the cover on the other.
 */
export function HeroMasthead({ name, tagline, cover, shopNow }: HeroProps) {
  return (
    <section className="grid gap-8 md:gap-14" data-testid="store-hero" data-hero="masthead">
      <h1 className="sf-display ed-masthead break-words text-center">{name}</h1>
      <div className="grid-12 items-end gap-y-8 border-t border-st-fg pt-6 md:pt-10">
        <div className={`col-span-4 grid content-end justify-items-start gap-8 ${cover ? "md:col-span-5 md:pb-2" : "md:col-span-8 md:col-start-3 md:justify-items-center md:text-center"}`}>
          {tagline && <p className="sf-display line-clamp-4 max-w-xl text-balance text-3xl leading-[1.15] md:text-5xl">{tagline}</p>}
          <a href="#products" className="ed-link t-label inline-flex min-h-11 items-center gap-2 border-b border-st-fg pb-0.5 text-sm">{shopNow}</a>
        </div>
        {cover && (
          <div className="col-span-4 overflow-hidden bg-[#F4F4F5] md:col-span-6 md:col-start-7">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover.url}
              srcSet={buildSrcSet(cover.renditions)}
              sizes={cover.renditions?.length ? "(min-width: 768px) 50vw, 100vw" : undefined}
              alt=""
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="aspect-[4/5] w-full object-cover md:max-h-[44rem]"
              style={coverStyle(cover)}
            />
          </div>
        )}
      </div>
    </section>
  );
}

/** Market banner: a compact promo panel — name, tagline and one action beside a wide crop of the cover. */
export function HeroBanner({ name, tagline, cover, shopNow }: HeroProps) {
  return (
    <section className="-mt-2 overflow-hidden rounded-xl border border-st-border bg-st-surface md:mt-0 md:grid md:min-h-[17rem] md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]" data-testid="store-hero" data-hero="banner">
      <div className="grid content-center justify-items-start gap-3 p-5 md:gap-4 md:p-10">
        <h1 className="t-headline break-words">{name}</h1>
        {tagline && <p className="line-clamp-2 max-w-md text-[15px] leading-snug text-muted md:text-lg">{tagline}</p>}
        <a href="#products" className="btn-gold mt-1 min-h-11 px-7">{shopNow}</a>
      </div>
      {cover && (
        <div className="order-first overflow-hidden bg-[#F4F4F5] md:order-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover.url}
            srcSet={buildSrcSet(cover.renditions)}
            sizes={cover.renditions?.length ? "(min-width: 768px) 50vw, 100vw" : undefined}
            alt=""
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="aspect-[16/8] w-full object-cover md:aspect-auto md:h-full"
            style={coverStyle(cover)}
          />
        </div>
      )}
    </section>
  );
}

/**
 * Gallery full-bleed: the cover runs edge to edge as a wide frame, the store name set in white along its lower edge on a
 * dark scrim (so it reads on any photo). With no cover the frame is a flat ink panel.
 */
export function HeroFullbleed({ name, tagline, cover, shopNow }: HeroProps) {
  return (
    <section className="bleed-x relative isolate -mt-6 overflow-hidden bg-[#0B0F1A] text-white sm:-mt-10 md:mt-0" data-testid="store-hero" data-hero="fullbleed">
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover.url}
          srcSet={buildSrcSet(cover.renditions)}
          sizes={cover.renditions?.length ? "100vw" : undefined}
          alt=""
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          style={coverStyle(cover)}
        />
      )}
      <div className="absolute inset-0 -z-[5] bg-gradient-to-t from-black/70 via-black/15 to-transparent" aria-hidden />
      <div className="grid min-h-[24rem] px-[var(--page-margin)] content-end justify-items-start gap-4 pb-8 pt-24 md:min-h-[34rem] md:pb-14">
        <h1 className="t-hero break-words text-white">{name}</h1>
        {tagline && <p className="line-clamp-2 max-w-md text-base leading-snug text-white/85 md:text-xl">{tagline}</p>}
        <a href="#products" className="inline-flex min-h-12 items-center justify-center border border-white px-8 text-sm font-medium uppercase tracking-[0.14em] text-white transition-colors duration-150 hover:bg-white hover:text-black">{shopNow}</a>
      </div>
    </section>
  );
}

/**
 * Boutique arch: everything centred. The store name and tagline sit above a tall arch-shaped window onto the cover
 * (rounded top, soft bottom), with a pill button between them. With no cover the arch is a blush panel.
 */
export function HeroArch({ name, tagline, cover, shopNow }: HeroProps) {
  return (
    <section className="grid justify-items-center gap-6 text-center md:gap-8" data-testid="store-hero" data-hero="arch">
      <h1 className="t-hero max-w-3xl text-balance break-words">{name}</h1>
      {tagline && <p className="line-clamp-2 max-w-md text-[17px] leading-snug text-muted md:text-xl">{tagline}</p>}
      <a href="#products" className="btn-gold min-h-12 w-full px-8 sm:w-auto">{shopNow}</a>
      {cover && (
        <div className="w-full max-w-[22rem] overflow-hidden rounded-t-[999px] rounded-b-3xl bg-[#F4F4F5] md:max-w-[30rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover.url}
            srcSet={buildSrcSet(cover.renditions)}
            sizes={cover.renditions?.length ? "(min-width: 768px) 480px, 352px" : undefined}
            alt=""
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="aspect-[3/4] w-full object-cover"
            style={coverStyle(cover)}
          />
        </div>
      )}
    </section>
  );
}

/**
 * Mono type hero: the store name set huge in the mono face between two heavy rules, tagline and a square full-width
 * button under it, then the cover as a hard-bordered square (no radius). With no cover it is type only.
 */
export function HeroType({ name, tagline, cover, shopNow }: HeroProps) {
  return (
    <section className="grid gap-6 border-y-2 border-st-fg py-6 md:gap-8 md:py-10" data-testid="store-hero" data-hero="type">
      <h1 className="mono-hero break-words">{name}</h1>
      <div className="grid items-end gap-6 md:grid-cols-[1fr_auto]">
        {tagline && <p className="line-clamp-3 max-w-xl text-[17px] leading-snug md:text-xl">{tagline}</p>}
        <a href="#products" className="btn-gold min-h-12 w-full px-8 md:w-auto">{shopNow}</a>
      </div>
      {cover && (
        <div className="overflow-hidden border-2 border-st-fg bg-[#F4F4F5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover.url}
            srcSet={buildSrcSet(cover.renditions)}
            sizes={cover.renditions?.length ? "(min-width: 1280px) 1200px, 100vw" : undefined}
            alt=""
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="aspect-[4/3] w-full object-cover grayscale md:aspect-[16/7]"
            style={coverStyle(cover)}
          />
        </div>
      )}
    </section>
  );
}

/**
 * Studio stage: one accent-coloured rounded stage. The store name is set large in the on-accent colour, a white pill
 * button under the tagline, and the cover sits on the inline end as a rounded card tilted two degrees (flat on phones).
 * Two crisp rings behind it stand in for a photo when the store has no cover.
 */
export function HeroStage({ name, tagline, cover, shopNow }: HeroProps) {
  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] bg-st-accent text-st-on-accent md:rounded-[2.5rem]" data-testid="store-hero" data-hero="stage">
      <span aria-hidden className="pointer-events-none absolute -end-24 -top-24 -z-10 h-72 w-72 rounded-full border-[28px] border-st-on-accent/10 md:h-[28rem] md:w-[28rem] md:border-[44px]" />
      <span aria-hidden className="pointer-events-none absolute -bottom-20 start-1/3 -z-10 h-40 w-40 rounded-full border-[18px] border-st-on-accent/10 md:h-64 md:w-64" />
      <div className={`grid items-center gap-8 px-6 py-10 md:gap-12 md:px-14 md:py-16 ${cover ? "md:grid-cols-[1.15fr_0.85fr]" : ""}`}>
        <div className="grid justify-items-start gap-5 md:gap-7">
          <h1 className="t-hero break-words">{name}</h1>
          {tagline && <p className="line-clamp-3 max-w-md text-[17px] leading-snug opacity-90 md:text-xl">{tagline}</p>}
          <a href="#products" className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-st-surface px-8 text-base font-semibold text-st-fg transition-transform duration-150 active:scale-[0.98] sm:w-auto">{shopNow}</a>
        </div>
        {cover && (
          <div className="overflow-hidden rounded-3xl bg-[#F4F4F5] shadow-e3 ring-4 ring-st-on-accent/20 md:rotate-2 rtl:md:-rotate-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover.url}
              srcSet={buildSrcSet(cover.renditions)}
              sizes={cover.renditions?.length ? "(min-width: 768px) 40vw, 100vw" : undefined}
              alt=""
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="aspect-[4/3] w-full object-cover md:aspect-[4/5]"
              style={coverStyle(cover)}
            />
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Atelier runway (premium): a centered tagline eyebrow and the store name in the display face, then the cover as a
 * cinematic crop (4:5 on phones, 21:9 from md) inside a hairline inset frame in the accent colour, a quiet text CTA.
 */
export function HeroRunway({ name, tagline, cover, shopNow }: HeroProps) {
  return (
    <section className="grid justify-items-center gap-6 text-center md:gap-10" data-testid="store-hero" data-hero="runway">
      <div className="grid justify-items-center gap-4 md:gap-5">
        {tagline && <p className="at-eyebrow line-clamp-2 max-w-xl text-sm text-muted md:text-base">{tagline}</p>}
        <h1 className="sf-display at-name break-words text-balance">{name}</h1>
      </div>
      {cover ? (
        <div className="at-frame relative w-full overflow-hidden bg-st-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover.url}
            srcSet={buildSrcSet(cover.renditions)}
            sizes={cover.renditions?.length ? "100vw" : undefined}
            alt=""
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="aspect-[4/5] w-full object-cover sm:aspect-[16/9] md:aspect-[21/9]"
            style={coverStyle(cover)}
          />
          <span aria-hidden className="at-inset pointer-events-none absolute inset-3 md:inset-5" />
        </div>
      ) : (
        <span aria-hidden className="at-rule h-px w-24" />
      )}
      <a href="#products" className="at-cta inline-flex min-h-12 items-center gap-3 px-8 text-sm">{shopNow}</a>
    </section>
  );
}

/**
 * Pulse bento (premium): a name tile with a live dot and the CTA, the cover as a tall tile, and an accent ticker
 * that loops the tagline (still under prefers-reduced-motion). Stacks name → cover → ticker on phones.
 */
export function HeroPulse({ name, tagline, cover, shopNow }: HeroProps) {
  const words = tagline || name;
  return (
    <section className={`grid gap-2 sm:gap-3 ${cover ? "md:grid-cols-[1.25fr_1fr]" : ""}`} data-testid="store-hero" data-hero="pulse">
      <div className="pulse-tile relative grid min-h-[15rem] content-between gap-8 overflow-hidden rounded-[1.75rem] bg-st-surface p-6 ring-1 ring-st-border md:min-h-[22rem] md:p-10">
        <span aria-hidden className="pulse-dot inline-flex h-3 w-3 rounded-full bg-st-accent" />
        <h1 className="t-hero break-words">{name}</h1>
        <a href="#products" className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-st-accent px-8 text-base font-bold text-st-on-accent transition-transform duration-150 active:scale-[0.98] sm:w-fit">{shopNow}</a>
      </div>
      {cover && (
        <div className="relative overflow-hidden rounded-[1.75rem] bg-st-surface md:row-span-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover.url}
            srcSet={buildSrcSet(cover.renditions)}
            sizes={cover.renditions?.length ? "(min-width: 768px) 45vw, 100vw" : undefined}
            alt=""
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="aspect-square h-full w-full object-cover md:aspect-auto"
            style={coverStyle(cover)}
          />
        </div>
      )}
      <div className="pulse-ticker overflow-hidden rounded-[1.75rem] bg-st-accent py-4 text-st-on-accent" aria-hidden>
        <div className="pulse-track flex w-max gap-8 whitespace-nowrap text-lg font-bold md:text-2xl">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="flex items-center gap-8">
              {words}
              <TickerStar className="h-4 w-4 shrink-0" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Four-point star between ticker items (SVG, not an emoji glyph). */
export function TickerStar({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 0c.9 6.6 4.4 10.6 12 12-7.6 1.4-11.1 5.4-12 12-.9-6.6-4.4-10.6-12-12 7.6-1.4 11.1-5.4 12-12z" />
    </svg>
  );
}
