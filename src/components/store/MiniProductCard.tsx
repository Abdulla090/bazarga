import Link from "next/link";
import { pickText, type Locale } from "@/lib/i18n";
import type { CatalogProduct } from "@/server/services/storefront";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { MerchBadges, type MerchBadgeLabels } from "./MerchBadges";
import { CardPrice, cardFrame, cardImage } from "./ProductCard";

/** Server-only rail card (best sellers, offers, "more from this store"): same look as the grid card, no client JS. */
export function MiniProductCard({ p, slug, locale, labels, from }: { p: CatalogProduct; slug: string; locale: Locale; labels: MerchBadgeLabels; from: string }) {
  const name = pickText(p.name, locale);
  return (
    <Link href={`/s/${slug}/p/${p.id}`} className="group grid h-full content-start gap-3">
      <span className={cardFrame}>
        {p.image ? <ResponsiveImage image={p.image} alt="" sizes="(min-width: 1024px) 270px, 42vw" index={9} className={cardImage} /> : <span className="block aspect-[4/5] w-full" />}
        <MerchBadges price={p.price} compareAtPrice={p.compareAtPrice} bestSeller={p.bestSeller} badge={p.badge} labels={labels} />
      </span>
      <span className="grid gap-1 px-0.5">
        <span className="line-clamp-2 text-sm leading-snug group-hover:underline group-hover:underline-offset-4">{name}</span>
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
 * Titled horizontal rail (scroll-snap). Phones show ~2.3 cards and bleed to the screen edge without widening the
 * page; desktops fit exactly four, so a short list stays a rail instead of a half-empty grid row.
 */
export function ProductStrip({
  id,
  title,
  products,
  slug,
  locale,
  labels,
  from,
  seeAll,
  testId,
}: {
  id: string;
  title: string;
  products: CatalogProduct[];
  slug: string;
  locale: Locale;
  labels: MerchBadgeLabels;
  from: string;
  seeAll?: { href: string; label: string };
  testId: string;
}) {
  if (!products.length) return null;
  return (
    <section aria-labelledby={id} className="section grid min-w-0 gap-4 sm:gap-6" data-testid={testId}>
      <SectionHead id={id} title={title} seeAll={seeAll} />
      <ul className="rail -mx-[var(--page-margin)] flex snap-x snap-mandatory scroll-px-[var(--page-margin)] gap-[var(--grid-gap)] overflow-x-auto px-[var(--page-margin)] pb-1">
        {products.map((r) => (
          <li key={r.id} className="reveal w-[42%] shrink-0 snap-start sm:w-[calc((100%-2*var(--grid-gap))/3)] lg:w-[calc((100%-3*var(--grid-gap))/4)]">
            <MiniProductCard p={r} slug={slug} locale={locale} labels={labels} from={from} />
          </li>
        ))}
      </ul>
    </section>
  );
}
