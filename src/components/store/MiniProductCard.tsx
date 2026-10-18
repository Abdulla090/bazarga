import Link from "next/link";
import { pickText, type Locale } from "@/lib/i18n";
import type { CatalogProduct } from "@/server/services/storefront";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { MerchBadges, type MerchBadgeLabels } from "./MerchBadges";
import type { CardVariant } from "@/lib/theme-studio/designs";
import { CardPrice, cardFrame, cardImage, cardName } from "./ProductCard";

/** Server-only rail card (best sellers, offers, "more from this store"): same look as the grid card, no client JS.
 *  `variant`: "feature" fills a taller bento cell. */
const sizes_ = (compact: boolean) => (compact ? "(min-width: 1024px) 17vw, 42vw" : "(min-width: 1024px) 400px, 42vw");

export function MiniProductCard({
  p,
  slug,
  locale,
  labels,
  from,
  variant = "default",
  look = "classic",
}: {
  p: CatalogProduct;
  slug: string;
  locale: Locale;
  labels: MerchBadgeLabels;
  from: string;
  variant?: "default" | "feature";
  /** Design family card look (editorial: display-type title over a rule; compact: square photo, dense text). */
  look?: CardVariant;
}) {
  const name = pickText(p.name, locale);
  if (look !== "classic" && look !== "soft" && look !== "row" && look !== "float" && variant === "default") {
    const compact = look === "compact" || look === "tile" || look === "glow";
    return (
      <Link href={`/s/${slug}/p/${p.id}`} className="group grid h-full content-start gap-2" data-card={look}>
        <span className={`${cardFrame} ${compact ? "aspect-square" : ""}`}>
          {p.image ? <ResponsiveImage image={p.image} alt="" sizes={sizes_(compact)} index={9} className={cardImage} /> : <span className="block aspect-[4/5] w-full" />}
          <MerchBadges price={p.price} compareAtPrice={p.compareAtPrice} bestSeller={p.bestSeller} badge={p.badge} labels={labels} />
        </span>
        {compact ? (
          <span className="grid gap-0.5 px-0.5">
            <span className="line-clamp-2 text-[13px] leading-snug group-hover:underline group-hover:underline-offset-4 md:text-sm">{name}</span>
            <CardPrice p={p} locale={locale} from={from} />
          </span>
        ) : (
          <span className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 border-t border-st-fg/80 pt-3">
            <span className="sf-display line-clamp-2 text-lg leading-tight group-hover:underline group-hover:underline-offset-4 md:text-xl">{name}</span>
            <CardPrice p={p} locale={locale} from={from} />
          </span>
        )}
      </Link>
    );
  }
  const sizes = variant === "feature" ? "(min-width: 768px) 50vw, 42vw" : "(min-width: 1024px) 400px, 42vw";
  const frame = `${cardFrame} ${variant === "feature" ? "md:min-h-0 md:flex-1" : ""}`;
  const img = variant === "feature" ? `${cardImage} md:absolute md:inset-0 md:h-full md:aspect-auto` : cardImage;
  return (
    <Link
      href={`/s/${slug}/p/${p.id}`}
      className={`group h-full content-start gap-3 ${variant === "feature" ? "grid md:flex md:flex-col" : "grid"}`}
    >
      <span className={frame}>
        {p.image ? <ResponsiveImage image={p.image} alt="" sizes={sizes} index={9} className={img} /> : <span className="block aspect-[4/5] w-full" />}
        <MerchBadges price={p.price} compareAtPrice={p.compareAtPrice} bestSeller={p.bestSeller} badge={p.badge} labels={labels} />
      </span>
      <span className="grid gap-1 px-0.5">
        <span className={`line-clamp-2 leading-snug group-hover:underline group-hover:underline-offset-4 ${variant === "default" ? cardName : `${cardName} md:t-title`}`}>
          {name}
        </span>
        <CardPrice p={p} locale={locale} from={from} />
      </span>
    </Link>
  );
}

/**
 * Section heading (Layout v3): optional index label ("01") over a 2–4 word light headline, optional "See all" link
 * aligned to the headline's baseline at the inline end.
 */
export function SectionHead({ id, title, index, seeAll, testId }: { id?: string; title: string; index?: string; seeAll?: { href: string; label: string }; testId?: string }) {
  return (
    <div className="reveal flex items-end justify-between gap-4">
      <div className="grid min-w-0 gap-2">
        {index && <span className="t-label section-index" aria-hidden>{index}</span>}
        <h2 id={id} className="t-headline min-w-0 truncate pb-[0.08em]" data-testid={testId}>
          {title}
        </h2>
      </div>
      {seeAll && (
        <Link href={seeAll.href} className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium underline underline-offset-4 hover:text-st-accent">
          {seeAll.label}
        </Link>
      )}
    </div>
  );
}

/**
 * Titled product set that is never a half-empty row (Layout v3 §4 "count-aware set"). Desktop (md+):
 * 6+ → a scroll-snap rail (four visible, the rest past the edge) · 5 → bento (feature tile over two rows + 2×2)
 * · 4 → four columns · 3 → three columns · 1–2 → "intro" row: the heading takes the columns the cards leave
 * (4 + 4 + 4, or 8 + 4), so two sale items fill the row as ordinary cards instead of half-empty split cards.
 * Phones: a rail of ~2.3 cards for 3+, a plain two-column row for 1–2. One markup, CSS-only switch.
 */
export function ProductStrip({
  id,
  title,
  index,
  products,
  slug,
  locale,
  labels,
  from,
  seeAll,
  note,
  testId,
  look = "classic",
}: {
  id: string;
  title: string;
  index?: string;
  products: CatalogProduct[];
  slug: string;
  locale: Locale;
  labels: MerchBadgeLabels;
  from: string;
  /** Unused; kept so callers can pass it. */
  view?: string;
  seeAll?: { href: string; label: string };
  /** One short line under the heading in the 1–2 item "intro" tile (e.g. "Up to 17% off"). */
  note?: string;
  testId: string;
  /** Design family card look for the cards in this strip. */
  look?: CardVariant;
}) {
  if (!products.length) return null;
  const n = products.length;
  const mode = n >= 6 ? "rail" : n === 5 ? "bento" : n >= 3 ? "row" : "intro";
  const rail =
    "rail -mx-[var(--page-margin)] flex snap-x snap-mandatory scroll-px-[var(--page-margin)] gap-[var(--grid-gap)] overflow-x-auto px-[var(--page-margin)] pb-1";
  const toGrid = "md:mx-0 md:grid md:grid-cols-12 md:gap-y-[var(--grid-gap)] md:overflow-visible md:px-0 md:pb-0";
  const ul =
    mode === "rail"
      ? rail
      : mode === "intro"
        ? `col-span-4 grid grid-cols-2 gap-x-[var(--grid-gap)] gap-y-8 md:row-start-1 md:grid-cols-subgrid ${n === 1 ? "md:col-span-4 md:col-start-9" : "md:col-span-8 md:col-start-5"}`
        : `${rail} ${toGrid}`;
  const railItem = "w-[42%] shrink-0 snap-start sm:w-[calc((100%-2*var(--grid-gap))/3)]";
  const li = (i: number) =>
    mode === "rail"
      ? `${railItem} lg:w-[calc((100%-3*var(--grid-gap))/4)]`
      : mode === "row"
        ? `${railItem} md:w-auto ${n === 4 ? "md:col-span-3" : "md:col-span-4"}`
        : mode === "bento"
          ? `${railItem} md:w-auto ${i === 0 ? "md:col-span-6 md:row-span-2" : "md:col-span-3"}`
          : "min-w-0 md:col-span-4";
  const variant = (i: number) => (mode === "bento" && i === 0 ? "feature" : "default");
  const list = (
    <ul className={ul} data-layout={mode}>
      {products.map((r, i) => (
        <li key={r.id} className={`reveal ${li(i)}`}>
          <MiniProductCard p={r} slug={slug} locale={locale} labels={labels} from={from} variant={variant(i)} look={look} />
        </li>
      ))}
    </ul>
  );
  if (mode === "intro")
    return (
      <section aria-labelledby={id} className="section grid-12 min-w-0 gap-y-4 sm:gap-y-6" data-testid={testId}>
        {/* Desktop: the heading becomes a promo tile on the surface tone that fills the columns the cards leave. */}
        <div
          className={`col-span-4 grid content-start gap-3 md:row-start-1 md:content-end md:gap-5 md:self-stretch md:rounded-2xl md:bg-st-surface md:p-10 ${n === 1 ? "md:col-span-8" : "md:col-span-4"}`}
          data-testid={`${testId}-intro`}
        >
          <SectionHead id={id} title={title} index={index} />
          {note && <p className="t-title text-muted">{note}</p>}
          {seeAll && (
            <Link href={seeAll.href} className="btn-ghost hidden w-fit min-h-12 px-7 md:inline-flex">
              {seeAll.label}
            </Link>
          )}
        </div>
        {list}
        {seeAll && (
          <Link href={seeAll.href} className="col-span-4 inline-flex min-h-11 w-fit items-center text-[15px] font-medium underline underline-offset-4 md:hidden">
            {seeAll.label}
          </Link>
        )}
      </section>
    );
  return (
    <section aria-labelledby={id} className="section grid min-w-0 gap-4 sm:gap-6" data-testid={testId}>
      <SectionHead id={id} title={title} index={index} seeAll={seeAll} />
      {list}
    </section>
  );
}
