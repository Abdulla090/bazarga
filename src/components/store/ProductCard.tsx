import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AddToCart } from "./AddToCart";
import { formatIQD } from "@/lib/money";
import { pickText, type Locale } from "@/lib/i18n";
import type { CatalogProduct } from "@/server/services/storefront";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { SIZES } from "@/lib/responsive-image";

/** `index` = position in the grid: the first row (2 cards on phones) loads eagerly with high priority, the rest lazily. */
export async function ProductCard({ p, slug, locale, index = 99 }: { p: CatalogProduct; slug: string; locale: Locale; index?: number }) {
  const t = await getTranslations("store");
  const name = pickText(p.name, locale);
  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
      <Link href={`/s/${slug}/p/${p.id}`} className="relative block">
        {p.image ? (
          <ResponsiveImage
            image={p.image}
            alt={name}
            sizes={SIZES.productGrid}
            index={index}
            aboveTheFold={2}
            className="aspect-square w-full object-cover"
          />
        ) : (
          <span className="block aspect-square w-full bg-paper" />
        )}
        {p.compareAtPrice && p.compareAtPrice > p.price && (
          <span className="chip absolute start-2 top-2 bg-danger text-[#fff] num">−{Math.round((1 - p.price / p.compareAtPrice) * 100)}%</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link href={`/s/${slug}/p/${p.id}`} className="font-bold leading-snug">{name}</Link>
        <p className="num">
          <span className="font-extrabold">{formatIQD(p.price, locale)}</span>
          {p.compareAtPrice && p.compareAtPrice > p.price && <s className="ms-2 text-sm text-ink-50">{formatIQD(p.compareAtPrice, locale)}</s>}
        </p>
        {p.lowStock !== null && <p className="text-xs font-semibold text-danger">{t("onlyLeft", { count: p.lowStock })}</p>}
        <div className="mt-auto">
          <AddToCart slug={slug} productId={p.id} disabled={p.soldOut} />
        </div>
      </div>
    </article>
  );
}
