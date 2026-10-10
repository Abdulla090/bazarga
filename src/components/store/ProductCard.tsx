import Link from "next/link";
import { ViewTransition } from "react";
import { AddToCart, type AddToCartLabels } from "./AddToCart";
import { formatIQD } from "@/lib/money";
import { pickText, type Locale } from "@/lib/i18n";
import type { CatalogProduct } from "@/server/services/storefront";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { SIZES } from "@/lib/responsive-image";
import { isOnSale } from "@/lib/merch";
import { MerchBadges, type MerchBadgeLabels } from "./MerchBadges";

export type ProductCardLabels = AddToCartLabels & { chooseOptions: string; from: string; onlyLeft: string; badges: MerchBadgeLabels };

const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

/** Price line shared by grid cards and rail cards: current price (500), struck old price faint. */
export function CardPrice({ p, locale, from }: { p: CatalogProduct; locale: Locale; from: string }) {
  return (
    <p className="num flex flex-wrap items-baseline gap-x-2 text-sm">
      <span className="font-medium">{p.priceMax > p.price ? fill(from, { price: formatIQD(p.price, locale) }) : formatIQD(p.price, locale)}</span>
      {isOnSale(p) && <s className="text-[13px] text-faint">{formatIQD(p.compareAtPrice!, locale)}</s>}
    </p>
  );
}

/** 4:5 photo on the placeholder tone, 16 px radius, no border or shadow; slow 1.03 zoom on hover. */
export const cardImage =
  "aspect-[4/5] w-full object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]";
export const cardFrame = "relative block overflow-hidden rounded-2xl bg-[#F4F4F5]";

/**
 * One product in the storefront grid (Dawn-style: photo + title + price, one badge). `index` = position: the first
 * row (2 cards on phones) loads eagerly with high priority, the rest lazily. On hover-capable desktops a small outline
 * pill appears over the photo to add to cart (or choose options); phones tap through to the product page.
 */
export function ProductCard({
  p,
  slug,
  locale,
  index = 99,
  labels,
}: {
  p: CatalogProduct;
  slug: string;
  locale: Locale;
  index?: number;
  labels: ProductCardLabels;
}) {
  const name = pickText(p.name, locale);
  const href = `/s/${slug}/p/${p.id}`;
  return (
    <article className="reveal group relative grid min-w-0 content-start gap-3">
      <div className={cardFrame}>
        <Link href={href} className="block" tabIndex={-1} aria-hidden>
          {/* Shared element: the photo morphs into the product page gallery (React View Transitions, grid only —
              rails show the same product again and a name must be unique on the page). */}
          <ViewTransition name={`product-${p.id}`} share="product-morph">
            {p.image ? (
              <ResponsiveImage image={p.image} alt="" sizes={SIZES.productGrid} index={index} aboveTheFold={2} className={cardImage} />
            ) : (
              <span className="block aspect-[4/5] w-full" />
            )}
          </ViewTransition>
        </Link>
        <MerchBadges price={p.price} compareAtPrice={p.compareAtPrice} bestSeller={p.bestSeller} badge={p.badge} soldOut={p.soldOut} labels={labels.badges} soldOutLabel={labels.soldOut} />
        <div className="absolute bottom-3 end-3 z-10 hidden opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:hover)]:md:block">
          {p.hasVariants && !p.soldOut ? (
            <Link href={href} className="btn-ghost btn-sm min-h-9 border-transparent bg-st-surface/95 px-4 shadow-e1 backdrop-blur">
              {labels.chooseOptions}
            </Link>
          ) : !p.soldOut ? (
            <AddToCart slug={slug} productId={p.id} labels={{ add: labels.add, added: labels.added, soldOut: labels.soldOut }} />
          ) : null}
        </div>
      </div>
      <div className="grid gap-1 px-0.5">
        <Link href={href} className="line-clamp-2 text-sm leading-snug after:absolute after:inset-0 after:content-[''] hover:underline hover:underline-offset-4">
          {name}
        </Link>
        <CardPrice p={p} locale={locale} from={labels.from} />
      </div>
    </article>
  );
}
