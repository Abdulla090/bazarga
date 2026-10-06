import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AddToCart } from "./AddToCart";
import { formatIQD } from "@/lib/money";
import { pickText, type Locale } from "@/lib/i18n";
import type { ProductWithImages } from "@/server/services/catalog";

export async function ProductCard({ p, slug, locale }: { p: ProductWithImages; slug: string; locale: Locale }) {
  const t = await getTranslations("store");
  const name = pickText(p.name, locale);
  const soldOut = p.stock !== null && p.stock <= 0;
  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
      <Link href={`/s/${slug}/p/${p.id}`} className="relative block">
        {p.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.images[0].url} alt={name} loading="lazy" className="aspect-square w-full object-cover" />
        ) : (
          <span className="block aspect-square w-full bg-paper" />
        )}
        {p.compareAtPrice && p.compareAtPrice > p.price && (
          <span className="chip absolute start-2 top-2 bg-danger text-white num">−{Math.round((1 - p.price / p.compareAtPrice) * 100)}%</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link href={`/s/${slug}/p/${p.id}`} className="font-bold leading-snug">{name}</Link>
        <p className="num">
          <span className="font-extrabold">{formatIQD(p.price, locale)}</span>
          {p.compareAtPrice && p.compareAtPrice > p.price && <s className="ms-2 text-sm text-ink-50">{formatIQD(p.compareAtPrice, locale)}</s>}
        </p>
        {p.stock !== null && p.stock > 0 && p.stock <= 5 && <p className="text-xs font-semibold text-danger">{t("onlyLeft", { count: p.stock })}</p>}
        <div className="mt-auto">
          <AddToCart slug={slug} productId={p.id} disabled={soldOut} />
        </div>
      </div>
    </article>
  );
}
