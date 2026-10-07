import Link from "next/link";
import { AddToCart, type AddToCartLabels } from "./AddToCart";
import { formatIQD } from "@/lib/money";
import { pickText, type Locale } from "@/lib/i18n";
import type { CatalogProduct } from "@/server/services/storefront";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { SIZES } from "@/lib/responsive-image";

export type ProductCardLabels = AddToCartLabels & { chooseOptions: string; from: string; onlyLeft: string };

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
  const onSale = p.compareAtPrice !== null && p.compareAtPrice > p.price;
  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
      <Link href={href} className="relative block">
        {p.image ? (
          <ResponsiveImage image={p.image} alt={name} sizes={SIZES.productGrid} index={index} aboveTheFold={2} className="aspect-square w-full object-cover" />
        ) : (
          <span className="block aspect-square w-full bg-paper" />
        )}
        {onSale && (
          <span className="chip num absolute start-2 top-2 bg-danger text-[#fff]">−{Math.round((1 - p.price / p.compareAtPrice!) * 100)}%</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <Link href={href} className="line-clamp-2 font-bold leading-snug">
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
            <AddToCart slug={slug} productId={p.id} disabled={p.soldOut} labels={labels} />
          )}
        </div>
      </div>
    </article>
  );
}
