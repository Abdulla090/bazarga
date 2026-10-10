import Link from "next/link";
import { formatIQD } from "@/lib/money";
import { pickText, type Locale } from "@/lib/i18n";
import { isOnSale } from "@/lib/merch";
import type { CatalogProduct } from "@/server/services/storefront";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { MerchBadges, type MerchBadgeLabels } from "./MerchBadges";

/** Compact, server-only card for horizontal strips (best sellers, offers, "more from this store"): no client JS. */
export function MiniProductCard({ p, slug, locale, labels, from }: { p: CatalogProduct; slug: string; locale: Locale; labels: MerchBadgeLabels; from: string }) {
  const name = pickText(p.name, locale);
  const price = p.priceMax > p.price ? from.replace("{price}", formatIQD(p.price, locale)) : formatIQD(p.price, locale);
  return (
    <Link href={`/s/${slug}/p/${p.id}`} className="block h-full overflow-hidden rounded-[var(--radius-card)] border border-st-border bg-st-surface">
      <span className="relative block">
        {p.image ? (
          <ResponsiveImage image={p.image} alt="" sizes="176px" index={9} className="aspect-square w-full object-cover" />
        ) : (
          <span className="block aspect-square w-full bg-st-bg" />
        )}
        <MerchBadges price={p.price} compareAtPrice={p.compareAtPrice} bestSeller={p.bestSeller} badge={p.badge} labels={labels} />
      </span>
      <span className="grid gap-1 p-2.5">
        <span className="line-clamp-2 min-h-10 text-sm font-bold leading-snug">{name}</span>
        <span className="num flex flex-wrap items-baseline gap-x-1.5 text-sm">
          <span className="font-extrabold">{price}</span>
          {isOnSale(p) && <s className="text-xs text-st-muted">{formatIQD(p.compareAtPrice!, locale)}</s>}
        </span>
      </span>
    </Link>
  );
}

/** Titled horizontal strip of mini cards (scroll-snap; bleeds to the screen edge on phones without widening the page). */
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
  icon,
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
  icon?: React.ReactNode;
}) {
  if (!products.length) return null;
  return (
    <section aria-labelledby={id} className="grid min-w-0 gap-3" data-testid={testId}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="flex min-w-0 items-center gap-2 text-lg font-extrabold">
          {icon}
          <span className="truncate">{title}</span>
        </h2>
        {seeAll && (
          <Link href={seeAll.href} className="inline-flex min-h-11 shrink-0 items-center text-sm font-bold text-st-fg underline underline-offset-4">
            {seeAll.label}
          </Link>
        )}
      </div>
      <ul className="-mx-4 flex snap-x lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {products.map((r) => (
          <li key={r.id} className="w-36 shrink-0 snap-start sm:w-44 lg:w-auto">
            <MiniProductCard p={r} slug={slug} locale={locale} labels={labels} from={from} />
          </li>
        ))}
      </ul>
    </section>
  );
}
