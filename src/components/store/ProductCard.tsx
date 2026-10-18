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
import { Icon, Plus } from "@/components/ui/icons";
import type { CardVariant } from "@/lib/theme-studio/designs";

export type ProductCardLabels = AddToCartLabels & { chooseOptions: string; from: string; onlyLeft: string; badges: MerchBadgeLabels };

const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

/** Price line shared by grid cards and rail cards: current price (500), struck old price faint. */
export function CardPrice({ p, locale, from }: { p: CatalogProduct; locale: Locale; from: string }) {
  return (
    <p className="num flex flex-wrap items-baseline gap-x-2 text-[15px] md:text-base">
      <span className="font-medium">{p.priceMax > p.price ? fill(from, { price: formatIQD(p.price, locale) }) : formatIQD(p.price, locale)}</span>
      {isOnSale(p) && <s className="text-[13px] text-muted md:text-sm">{formatIQD(p.compareAtPrice!, locale)}</s>}
    </p>
  );
}

/** 4:5 photo on the placeholder tone, 16 px radius, no border or shadow; slow 1.03 zoom on hover. */
export const cardImage =
  "sf-img aspect-[4/5] w-full object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]";
export const cardFrame = "sf-frame relative block overflow-hidden rounded-2xl bg-[#F4F4F5]";
/** Card title: 15 px on phones, 16 px from md (was 14 px, too small on desktop). */
export const cardName = "text-[15px] md:text-base";

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
  variant = "classic",
  number,
}: {
  p: CatalogProduct;
  slug: string;
  locale: Locale;
  index?: number;
  labels: ProductCardLabels;
  /** Design family card: classic (photo + title + price), tile (gallery: photo-only tile, caption on a scrim), editorial (numbered, display-type title, price on a hairline), compact (square photo, always-on add button, dense text). */
  variant?: CardVariant;
  /** Editorial plate number ("01"). */
  number?: string;
}) {
  const name = pickText(p.name, locale);
  const href = `/s/${slug}/p/${p.id}`;
  if (variant === "editorial") {
    return (
      <article className="reveal group relative grid min-w-0 content-start gap-4" data-card="editorial">
        <div className={cardFrame}>
          <Link href={href} className="block" tabIndex={-1} aria-hidden>
            {p.image ? (
              <ResponsiveImage image={p.image} alt="" sizes={SIZES.productGrid} index={index} aboveTheFold={2} className={cardImage} />
            ) : (
              <span className="block aspect-[4/5] w-full" />
            )}
          </Link>
          <MerchBadges price={p.price} compareAtPrice={p.compareAtPrice} bestSeller={p.bestSeller} badge={p.badge} soldOut={p.soldOut} labels={labels.badges} soldOutLabel={labels.soldOut} />
          <div className="absolute bottom-3 end-3 z-10 hidden opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:hover)]:md:block">
            {p.hasVariants && !p.soldOut ? (
              <Link href={href} className="btn-ghost btn-sm min-h-9 border-transparent bg-st-surface/95 px-4 shadow-e1 backdrop-blur">{labels.chooseOptions}</Link>
            ) : !p.soldOut ? (
              <AddToCart slug={slug} productId={p.id} labels={{ add: labels.add, added: labels.added, soldOut: labels.soldOut }} item={{ name, image: p.image?.url ?? null, price: formatIQD(p.price, locale) }} />
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 border-t border-st-fg/80 pt-3">
          {number && <span className="t-label section-index col-span-2" aria-hidden>{number}</span>}
          <Link href={href} className="sf-display line-clamp-2 text-xl leading-tight after:absolute after:inset-0 after:content-[''] md:text-2xl">{name}</Link>
          <CardPrice p={p} locale={locale} from={labels.from} />
        </div>
      </article>
    );
  }
  if (variant === "soft") {
    return (
      <article className="reveal group relative grid min-w-0 content-start gap-3 text-center" data-card="soft">
        <div className={`${cardFrame} !rounded-3xl`}>
          <Link href={href} className="block" tabIndex={-1} aria-hidden>
            {p.image ? (
              <ResponsiveImage image={p.image} alt="" sizes={SIZES.productGrid} index={index} aboveTheFold={2} className={cardImage} />
            ) : (
              <span className="block aspect-[4/5] w-full" />
            )}
          </Link>
          <MerchBadges price={p.price} compareAtPrice={p.compareAtPrice} bestSeller={p.bestSeller} badge={p.badge} soldOut={p.soldOut} labels={labels.badges} soldOutLabel={labels.soldOut} corner="top" />
          <div className="absolute bottom-2 end-2 z-10">
            {p.hasVariants && !p.soldOut ? (
              <Link href={href} aria-label={labels.chooseOptions} className="flex h-11 w-11 items-center justify-center rounded-full bg-st-surface text-st-fg shadow-e1 transition-transform duration-150 active:scale-95">
                <Icon as={Plus} className="h-5 w-5" />
              </Link>
            ) : !p.soldOut ? (
              <AddToCart
                slug={slug}
                productId={p.id}
                labels={{ add: labels.add, added: labels.added, soldOut: labels.soldOut }}
                item={{ name, image: p.image?.url ?? null, price: formatIQD(p.price, locale) }}
                icon={<Icon as={Plus} className="h-5 w-5" />}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-st-surface text-st-fg shadow-e1 transition-transform duration-150 active:scale-95"
              />
            ) : null}
          </div>
        </div>
        <div className="grid justify-items-center gap-1 px-1">
          <Link href={href} className="line-clamp-2 text-[15px] leading-snug after:absolute after:inset-0 after:content-[''] md:text-base">{name}</Link>
          <CardPrice p={p} locale={locale} from={labels.from} />
        </div>
      </article>
    );
  }
  if (variant === "float") {
    // Masonry: the photo ratio cycles with the card's position so columns never line up.
    const ratio = ["aspect-[4/5]", "aspect-square", "aspect-[3/4]"][(Number(number) || 0) % 3];
    const addCls = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-st-accent text-st-on-accent transition-transform duration-150 active:scale-95";
    return (
      <article className="reveal group relative grid min-w-0 content-start gap-3 rounded-3xl bg-st-surface p-2 shadow-e1 ring-1 ring-st-border" data-card="float">
        <div className="sf-frame relative block overflow-hidden rounded-[1.25rem] bg-[#F4F4F5]">
          <Link href={href} className="block" tabIndex={-1} aria-hidden>
            {p.image ? (
              <ResponsiveImage image={p.image} alt="" sizes={SIZES.productGrid} index={index} aboveTheFold={2} className={`sf-img ${ratio} w-full object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]`} />
            ) : (
              <span className={`block ${ratio} w-full`} />
            )}
          </Link>
          <MerchBadges price={p.price} compareAtPrice={p.compareAtPrice} bestSeller={p.bestSeller} badge={p.badge} soldOut={p.soldOut} labels={labels.badges} soldOutLabel={labels.soldOut} corner="top" />
        </div>
        <div className="flex items-end justify-between gap-2 px-2 pb-1">
          <div className="grid min-w-0 gap-0.5">
            <Link href={href} className="line-clamp-2 text-[15px] font-semibold leading-snug after:absolute after:inset-0 after:content-[''] md:text-base">{name}</Link>
            <CardPrice p={p} locale={locale} from={labels.from} />
          </div>
          <div className="relative z-10">
            {p.hasVariants && !p.soldOut ? (
              <Link href={href} aria-label={labels.chooseOptions} className={addCls}>
                <Icon as={Plus} className="h-5 w-5" />
              </Link>
            ) : !p.soldOut ? (
              <AddToCart
                slug={slug}
                productId={p.id}
                labels={{ add: labels.add, added: labels.added, soldOut: labels.soldOut }}
                item={{ name, image: p.image?.url ?? null, price: formatIQD(p.price, locale) }}
                icon={<Icon as={Plus} className="h-5 w-5" />}
                className={addCls}
              />
            ) : null}
          </div>
        </div>
      </article>
    );
  }
  if (variant === "row") {
    const addCls = "flex h-11 w-11 items-center justify-center border-2 border-st-fg bg-st-surface text-st-fg transition-colors duration-150 hover:bg-st-fg hover:text-st-bg active:scale-95";
    return (
      <article className="reveal group relative grid min-w-0 grid-cols-[6rem_1fr_auto] items-center gap-x-4 border-t-2 border-st-fg py-4 md:grid-cols-[7rem_1fr_auto]" data-card="row">
        <div className="sf-frame relative overflow-hidden border-2 border-st-fg bg-[#F4F4F5]">
          <Link href={href} className="block" tabIndex={-1} aria-hidden>
            {p.image ? (
              <ResponsiveImage image={p.image} alt="" sizes="112px" index={index} aboveTheFold={4} className="sf-img aspect-square w-full object-cover" />
            ) : (
              <span className="block aspect-square w-full" />
            )}
          </Link>
        </div>
        <div className="grid min-w-0 gap-1">
          {number && <span className="mono-label num" aria-hidden>{number}</span>}
          <Link href={href} className="line-clamp-2 text-[15px] font-semibold leading-snug after:absolute after:inset-0 after:content-[''] md:text-base">{name}</Link>
          <CardPrice p={p} locale={locale} from={labels.from} />
          {p.soldOut && <span className="mono-label" data-testid="badge-soldout">{labels.soldOut}</span>}
        </div>
        <div className="relative z-10">
          {p.hasVariants && !p.soldOut ? (
            <Link href={href} aria-label={labels.chooseOptions} className={addCls}>
              <Icon as={Plus} className="h-5 w-5" />
            </Link>
          ) : !p.soldOut ? (
            <AddToCart
              slug={slug}
              productId={p.id}
              labels={{ add: labels.add, added: labels.added, soldOut: labels.soldOut }}
              item={{ name, image: p.image?.url ?? null, price: formatIQD(p.price, locale) }}
              icon={<Icon as={Plus} className="h-5 w-5" />}
              className={addCls}
            />
          ) : null}
        </div>
      </article>
    );
  }
  if (variant === "frame") {
    // Atelier: portrait photo inside an accent hairline inset, centered display-face name, price in the accent tone.
    return (
      <article className="reveal group relative grid min-w-0 content-start gap-4 text-center" data-card="frame">
        <div className="sf-frame at-frame relative block overflow-hidden bg-st-surface">
          <Link href={href} className="block" tabIndex={-1} aria-hidden>
            {p.image ? (
              <ResponsiveImage image={p.image} alt="" sizes={SIZES.productGrid} index={index} aboveTheFold={2} className={cardImage} />
            ) : (
              <span className="block aspect-[4/5] w-full" />
            )}
          </Link>
          <span aria-hidden className="at-inset pointer-events-none absolute inset-2.5" />
          <MerchBadges price={p.price} compareAtPrice={p.compareAtPrice} bestSeller={p.bestSeller} badge={p.badge} soldOut={p.soldOut} labels={labels.badges} soldOutLabel={labels.soldOut} corner="top" />
          <div className="absolute inset-x-0 bottom-4 z-10 hidden justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:hover)]:md:flex">
            {p.hasVariants && !p.soldOut ? (
              <Link href={href} className="btn-ghost btn-sm min-h-9 border-st-fg/40 bg-st-bg/90 px-4 backdrop-blur">{labels.chooseOptions}</Link>
            ) : !p.soldOut ? (
              <AddToCart slug={slug} productId={p.id} labels={{ add: labels.add, added: labels.added, soldOut: labels.soldOut }} item={{ name, image: p.image?.url ?? null, price: formatIQD(p.price, locale) }} />
            ) : null}
          </div>
        </div>
        <div className="grid justify-items-center gap-1.5 px-2">
          <Link href={href} className="sf-display line-clamp-2 text-lg leading-snug after:absolute after:inset-0 after:content-[''] md:text-xl">{name}</Link>
          <span aria-hidden className="at-rule h-px w-8" />
          <div className="text-st-accent [&_s]:text-muted"><CardPrice p={p} locale={locale} from={labels.from} /></div>
        </div>
      </article>
    );
  }
  if (variant === "glow") {
    // Pulse: a square tile (2×2 when the bento grid features it), caption on a dark scrim, accent add button, accent glow on hover.
    const addCls = "flex h-11 w-11 items-center justify-center rounded-full bg-st-accent text-st-on-accent shadow-e1 transition-transform duration-150 active:scale-95";
    return (
      <article className="reveal group relative h-full min-w-0" data-card="glow">
        <div className="sf-frame pulse-card relative block h-full overflow-hidden rounded-[1.25rem] bg-st-surface ring-1 ring-st-border transition-shadow duration-200">
          <Link href={href} className="block h-full" tabIndex={-1} aria-hidden>
            {p.image ? (
              <ResponsiveImage image={p.image} alt="" sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" index={index} aboveTheFold={4} className="sf-img aspect-square h-full w-full object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.04]" />
            ) : (
              <span className="block aspect-square h-full w-full" />
            )}
          </Link>
          <MerchBadges price={p.price} compareAtPrice={p.compareAtPrice} bestSeller={p.bestSeller} badge={p.badge} soldOut={p.soldOut} labels={labels.badges} soldOutLabel={labels.soldOut} corner="top" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 grid gap-0.5 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-3 pt-12 pe-16 text-white">
            <Link href={href} className="pointer-events-auto line-clamp-2 text-[14px] font-bold leading-snug after:absolute after:inset-0 after:content-[''] md:text-base">{name}</Link>
            <span className="num text-sm font-semibold text-[#E8FF9A]">{p.priceMax > p.price ? fill(labels.from, { price: formatIQD(p.price, locale) }) : formatIQD(p.price, locale)}</span>
          </div>
          <div className="absolute bottom-2.5 end-2.5 z-10">
            {p.hasVariants && !p.soldOut ? (
              <Link href={href} aria-label={labels.chooseOptions} className={addCls}>
                <Icon as={Plus} className="h-5 w-5" />
              </Link>
            ) : !p.soldOut ? (
              <AddToCart
                slug={slug}
                productId={p.id}
                labels={{ add: labels.add, added: labels.added, soldOut: labels.soldOut }}
                item={{ name, image: p.image?.url ?? null, price: formatIQD(p.price, locale) }}
                icon={<Icon as={Plus} className="h-5 w-5" />}
                className={addCls}
              />
            ) : null}
          </div>
        </div>
      </article>
    );
  }
  if (variant === "tile") {
    return (
      <article className="reveal group relative min-w-0" data-card="tile">
        <div className={`${cardFrame} aspect-[4/5]`}>
          <Link href={href} className="block" tabIndex={-1} aria-hidden>
            {p.image ? (
              <ResponsiveImage image={p.image} alt="" sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" index={index} aboveTheFold={4} className={`${cardImage} h-full`} />
            ) : (
              <span className="block aspect-[4/5] w-full" />
            )}
          </Link>
          <MerchBadges price={p.price} compareAtPrice={p.compareAtPrice} bestSeller={p.bestSeller} badge={p.badge} soldOut={p.soldOut} labels={labels.badges} soldOutLabel={labels.soldOut} corner="top" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 grid gap-0.5 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-3 pt-10 pe-14 text-white">
            <Link href={href} className="pointer-events-auto line-clamp-2 text-[13px] font-medium uppercase leading-snug tracking-[0.06em] after:absolute after:inset-0 after:content-[''] md:text-sm">{name}</Link>
            <span className="num text-sm font-medium">{p.priceMax > p.price ? fill(labels.from, { price: formatIQD(p.price, locale) }) : formatIQD(p.price, locale)}</span>
          </div>
          <div className="absolute bottom-1.5 end-1.5 z-10">
            {p.hasVariants && !p.soldOut ? (
              <Link href={href} aria-label={labels.chooseOptions} className="flex h-11 w-11 items-center justify-center bg-st-surface text-st-fg transition-colors duration-150 hover:bg-st-bg">
                <Icon as={Plus} className="h-5 w-5" />
              </Link>
            ) : !p.soldOut ? (
              <AddToCart
                slug={slug}
                productId={p.id}
                labels={{ add: labels.add, added: labels.added, soldOut: labels.soldOut }}
                item={{ name, image: p.image?.url ?? null, price: formatIQD(p.price, locale) }}
                icon={<Icon as={Plus} className="h-5 w-5" />}
                className="flex h-11 w-11 items-center justify-center bg-st-surface text-st-fg transition-[background-color,transform] duration-150 hover:bg-st-bg active:scale-95"
              />
            ) : null}
          </div>
        </div>
      </article>
    );
  }
  if (variant === "compact") {
    return (
      <article className="reveal group relative grid min-w-0 content-start gap-2" data-card="compact">
        <div className={`${cardFrame} aspect-square`}>
          <Link href={href} className="block" tabIndex={-1} aria-hidden>
            {p.image ? (
              <ResponsiveImage image={p.image} alt="" sizes="(min-width: 1280px) 17vw, (min-width: 768px) 24vw, 50vw" index={index} aboveTheFold={4} className={cardImage} />
            ) : (
              <span className="block aspect-square w-full" />
            )}
          </Link>
          <MerchBadges price={p.price} compareAtPrice={p.compareAtPrice} bestSeller={p.bestSeller} badge={p.badge} soldOut={p.soldOut} labels={labels.badges} soldOutLabel={labels.soldOut} />
          <div className="absolute bottom-1.5 end-1.5 z-10">
            {p.hasVariants && !p.soldOut ? (
              <Link href={href} aria-label={labels.chooseOptions} className="flex h-11 w-11 items-center justify-center rounded-full bg-st-surface text-st-fg shadow-e1 transition-colors duration-150 hover:bg-st-bg">
                <Icon as={Plus} className="h-5 w-5" />
              </Link>
            ) : !p.soldOut ? (
              <AddToCart
                slug={slug}
                productId={p.id}
                labels={{ add: labels.add, added: labels.added, soldOut: labels.soldOut }}
                item={{ name, image: p.image?.url ?? null, price: formatIQD(p.price, locale) }}
                icon={<Icon as={Plus} className="h-5 w-5" />}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-st-surface text-st-fg shadow-e1 transition-[background-color,transform] duration-150 hover:bg-st-bg active:scale-95"
              />
            ) : null}
          </div>
        </div>
        <div className="grid gap-0.5 px-0.5">
          <Link href={href} className="line-clamp-2 text-[13px] leading-snug after:absolute after:inset-0 after:content-[''] hover:underline hover:underline-offset-4 md:text-sm">{name}</Link>
          <CardPrice p={p} locale={locale} from={labels.from} />
        </div>
      </article>
    );
  }
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
            <AddToCart
              slug={slug}
              productId={p.id}
              labels={{ add: labels.add, added: labels.added, soldOut: labels.soldOut }}
              item={{ name, image: p.image?.url ?? null, price: formatIQD(p.price, locale) }}
            />
          ) : null}
        </div>
      </div>
      <div className="grid gap-1 px-0.5">
        <Link href={href} className={`line-clamp-2 leading-snug ${cardName} after:absolute after:inset-0 after:content-[''] hover:underline hover:underline-offset-4`}>
          {name}
        </Link>
        <CardPrice p={p} locale={locale} from={labels.from} />
      </div>
    </article>
  );
}
