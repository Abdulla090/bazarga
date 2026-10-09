import Link from "next/link";
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

/**
 * One product in the storefront grid. `index` = position: the first row (2 cards on phones) loads eagerly with
 * high priority, the rest lazily. Labels come pre-translated (the card renders inside a server component).
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
  const onSale = isOnSale(p);
  return (
    <article className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-st-border bg-st-surface shadow-e1 transition-[box-shadow,transform] duration-[var(--duration-base)] ease-[var(--ease-out-expo)] motion-safe:hover:-translate-y-0.5 hover:shadow-e2">
      <Link href={href} className="relative block overflow-hidden">
        {p.image ? (
          <ResponsiveImage image={p.image} alt={name} sizes={SIZES.productGrid} index={index} aboveTheFold={2} className="aspect-square w-full object-cover transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out-expo)] motion-safe:group-hover:scale-[1.03]" />
        ) : (
          <span className="block aspect-square w-full bg-paper" />
        )}
        <MerchBadges price={p.price} compareAtPrice={p.compareAtPrice} bestSeller={p.bestSeller} badge={p.badge} labels={labels.badges} />
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <Link href={href} className="line-clamp-2 min-h-11 font-bold leading-snug">
          {name}
        </Link>
        <p className="num">
          <span className="font-extrabold">{p.priceMax > p.price ? fill(labels.from, { price: formatIQD(p.price, locale) }) : formatIQD(p.price, locale)}</span>
          {onSale && <s className="ms-2 text-sm text-ink-50">{formatIQD(p.compareAtPrice!, locale)}</s>}
        </p>
        {p.lowStock !== null && <p className="text-xs font-semibold text-danger">{fill(labels.onlyLeft, { count: p.lowStock })}</p>}
        <div className="mt-auto pt-1">
          {p.hasVariants && !p.soldOut ? (
            <Link href={href} className="btn-gold btn-sm w-full">
              {labels.chooseOptions}
            </Link>
          ) : (
            <AddToCart slug={slug} productId={p.id} disabled={p.soldOut} labels={{ add: labels.add, added: labels.added, soldOut: labels.soldOut }} />
          )}
        </div>
      </div>
    </article>
  );
}
