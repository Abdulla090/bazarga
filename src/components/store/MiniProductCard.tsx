import Link from "next/link";
import { pickText, type Locale } from "@/lib/i18n";
import type { CatalogProduct } from "@/server/services/storefront";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { MerchBadges, type MerchBadgeLabels } from "./MerchBadges";
import { CardPrice, cardFrame, cardImage } from "./ProductCard";

/** Server-only rail card (best sellers, offers, "more from this store"): same look as the grid card, no client JS.
 *  `variant`: "feature" fills a taller bento cell; "split" puts the photo and the text side by side from `md` up. */
export function MiniProductCard({
  p,
  slug,
  locale,
  labels,
  from,
  variant = "default",
  view,
}: {
  p: CatalogProduct;
  slug: string;
  locale: Locale;
  labels: MerchBadgeLabels;
  from: string;
  variant?: "default" | "feature" | "split";
  view?: string;
}) {
  const name = pickText(p.name, locale);
  const sizes =
    variant === "feature" ? "(min-width: 768px) 50vw, 42vw" : variant === "split" ? "(min-width: 768px) 25vw, 45vw" : "(min-width: 1024px) 400px, 42vw";
  const frame = `${cardFrame} ${variant === "feature" ? "md:min-h-0 md:flex-1" : ""}`;
  const img = variant === "feature" ? `${cardImage} md:absolute md:inset-0 md:h-full md:aspect-auto` : cardImage;
  return (
    <Link
      href={`/s/${slug}/p/${p.id}`}
      className={`group h-full content-start gap-3 ${
        variant === "feature" ? "grid md:flex md:flex-col" : variant === "split" ? "grid md:grid-cols-2 md:items-end md:gap-[var(--grid-gap)]" : "grid"
      }`}
    >
      <span className={frame}>
        {p.image ? <ResponsiveImage image={p.image} alt="" sizes={sizes} index={9} className={img} /> : <span className="block aspect-[4/5] w-full" />}
        <MerchBadges price={p.price} compareAtPrice={p.compareAtPrice} bestSeller={p.bestSeller} badge={p.badge} labels={labels} />
      </span>
      <span className={`grid gap-1 px-0.5 ${variant === "split" ? "md:gap-3 md:pb-2" : ""}`}>
        <span className={`line-clamp-2 leading-snug group-hover:underline group-hover:underline-offset-4 ${variant === "default" ? "text-sm" : "text-sm md:t-title"}`}>
          {name}
        </span>
        <CardPrice p={p} locale={locale} from={from} />
        {variant === "split" && view && (
          <span className="mt-2 hidden w-fit items-center gap-1.5 text-sm font-medium underline underline-offset-4 md:inline-flex">{view}</span>
        )}
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
 * · 4 → four columns · 3 → three columns · 1–2 → split cards (photo + text side by side, six columns each).
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
  view,
  seeAll,
  testId,
}: {
  id: string;
  title: string;
  index?: string;
  products: CatalogProduct[];
  slug: string;
  locale: Locale;
  labels: MerchBadgeLabels;
  from: string;
  /** "View" link text on split cards. */
  view?: string;
  seeAll?: { href: string; label: string };
  testId: string;
}) {
  if (!products.length) return null;
  const n = products.length;
  const mode = n >= 6 ? "rail" : n === 5 ? "bento" : n >= 3 ? "row" : "split";
  const rail =
    "rail -mx-[var(--page-margin)] flex snap-x snap-mandatory scroll-px-[var(--page-margin)] gap-[var(--grid-gap)] overflow-x-auto px-[var(--page-margin)] pb-1";
  const toGrid = "md:mx-0 md:grid md:grid-cols-12 md:gap-y-[var(--grid-gap)] md:overflow-visible md:px-0 md:pb-0";
  const ul =
    mode === "rail" ? rail : mode === "split" ? "grid grid-cols-2 gap-x-[var(--grid-gap)] gap-y-8 md:grid-cols-12" : `${rail} ${toGrid}`;
  const railItem = "w-[42%] shrink-0 snap-start sm:w-[calc((100%-2*var(--grid-gap))/3)]";
  const li = (i: number) =>
    mode === "rail"
      ? `${railItem} lg:w-[calc((100%-3*var(--grid-gap))/4)]`
      : mode === "row"
        ? `${railItem} md:w-auto ${n === 4 ? "md:col-span-3" : "md:col-span-4"}`
        : mode === "bento"
          ? `${railItem} md:w-auto ${i === 0 ? "md:col-span-6 md:row-span-2" : "md:col-span-3"}`
          : `min-w-0 md:col-span-6`;
  const variant = (i: number) => (mode === "bento" && i === 0 ? "feature" : mode === "split" ? "split" : "default");
  return (
    <section aria-labelledby={id} className="section grid min-w-0 gap-4 sm:gap-6" data-testid={testId}>
      <SectionHead id={id} title={title} index={index} seeAll={seeAll} />
      <ul className={ul} data-layout={mode}>
        {products.map((r, i) => (
          <li key={r.id} className={`reveal ${li(i)}`}>
            <MiniProductCard p={r} slug={slug} locale={locale} labels={labels} from={from} variant={variant(i)} view={view} />
          </li>
        ))}
      </ul>
    </section>
  );
}
