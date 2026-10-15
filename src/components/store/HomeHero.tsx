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
