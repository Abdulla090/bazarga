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

/** Section heading used across the storefront: 2–4 words, light display type, optional "See all" text link. */
export function SectionHead({ id, title, seeAll, testId }: { id?: string; title: string; seeAll?: { href: string; label: string }; testId?: string }) {
  return (
    <div className="reveal flex items-end justify-between gap-3">
      <h2 id={id} className="display min-w-0 truncate text-[22px] sm:text-[28px]" data-testid={testId}>
        {title}
      </h2>
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
    <section aria-labelledby={id} className="mt-8 grid min-w-0 gap-4 sm:mt-14 sm:gap-6" data-testid={testId}>
      <SectionHead id={id} title={title} seeAll={seeAll} />
      <ul className="rail -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:scroll-px-6 sm:gap-5 sm:px-6">
        {products.map((r) => (
          <li key={r.id} className="reveal w-[42%] shrink-0 snap-start sm:w-[calc((100%-2*1.25rem)/3)] lg:w-[calc((100%-3*1.25rem)/4)]">
            <MiniProductCard p={r} slug={slug} locale={locale} labels={labels} from={from} />
          </li>
        ))}
      </ul>
    </section>
  );
}
