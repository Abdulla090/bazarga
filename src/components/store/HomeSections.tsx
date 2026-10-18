import Link from "next/link";
import { pickText, type Locale } from "@/lib/i18n";
import type { CatalogCategory, CatalogProduct } from "@/server/services/storefront";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { formatIQD } from "@/lib/money";
import { isOnSale } from "@/lib/merch";
import { ArrowForward } from "@/components/ui/icons";
import { AddToCart } from "./AddToCart";
import { SectionHead } from "./MiniProductCard";

const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

/**
 * Collections bento (Layout v3 §4.3): one photographic tile per category, cover = the category's first product photo.
 * Desktop composition by count — 2: 6+6 · 3: tall 6 (2 rows) + two wide 6 · 4: tall + wide + 3+3 · 5: tall + 2×2.
 * Phone: the first tile full width, the rest in two columns (an odd last tile spans both). The name sits on a
 * canvas-coloured plate cut into the bottom-start corner, so it reads as type on the page, not text on a photo.
 */
export function CollectionBento({
  categories,
  products,
  slug,
  locale,
  title,
  index,
  countLabel,
}: {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  slug: string;
  locale: Locale;
  title: string;
  index: string;
  /** "{count}" filled with the number of products in the category. */
  countLabel: (count: number) => string;
}) {
  const tiles = categories
    .map((c) => {
      const items = products.filter((p) => p.categoryId === c.id);
      return { c, cover: items.find((p) => p.image)?.image ?? null, count: items.length };
    })
    .filter((t) => t.cover && t.count > 0)
    .slice(0, 5);
  if (tiles.length < 2) return null;
  const n = tiles.length;
  // Desktop placement per tile (12-col grid, 2 rows of equal height for n ≥ 3).
  const place = (i: number) => {
    if (n === 2) return "md:col-span-6 md:row-span-2";
    if (i === 0) return "md:col-span-6 md:row-span-2";
    if (n === 3) return "md:col-span-6";
    if (n === 4) return i === 1 ? "md:col-span-6" : "md:col-span-3";
    return "md:col-span-3";
  };
  const phone = (i: number) => (i === 0 || (n % 2 === 0 && i === n - 1) ? "col-span-2 aspect-[4/3]" : "col-span-1 aspect-[4/5]");
  return (
    <section aria-labelledby="collections-h" className="section grid gap-4 sm:gap-6" data-testid="collections">
      <SectionHead id="collections-h" title={title} index={index} />
      <ul className="grid grid-cols-2 gap-[var(--grid-gap)] md:h-[min(70vh,40rem)] md:grid-cols-12 md:grid-rows-2">
        {tiles.map(({ c, cover, count }, i) => (
          <li key={c.id} className={`reveal relative min-h-0 ${phone(i)} md:aspect-auto ${place(i)}`}>
            <Link href={`/s/${slug}?c=${c.id}#products`} className="group relative block h-full overflow-hidden rounded-2xl bg-[#F4F4F5]">
              <ResponsiveImage
                image={cover!}
                alt=""
                sizes={i === 0 ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"}
                index={9}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]"
              />
              <span className="absolute bottom-0 start-0 grid max-w-[85%] gap-0.5 rounded-se-2xl bg-st-bg pe-5 pt-3 sm:pe-6 sm:pt-4">
                <span className="t-title truncate">{pickText(c.name, locale)}</span>
                <span className="t-label flex items-center gap-1.5 text-muted">
                  {countLabel(count)}
                  <ArrowForward className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Spotlight band (Layout v3 §4.5): full-bleed white surface, one product as a 60/40 editorial split — photo on the
 * inline start, index + name in display type, price, one line of description, "View" (ink) and "Add to cart"
 * (outline, simple products only).
 */
export function Spotlight({
  p,
  slug,
  locale,
  index,
  eyebrow,
  description,
  labels,
}: {
  p: CatalogProduct;
  slug: string;
  locale: Locale;
  index: string;
  eyebrow?: string;
  description?: string;
  labels: { view: string; add: string; added: string; soldOut: string; from: string };
}) {
  const name = pickText(p.name, locale);
  const href = `/s/${slug}/p/${p.id}`;
  return (
    <section className="section bleed bg-st-surface py-10 md:py-14" aria-labelledby="spotlight-h" data-testid="spotlight">
      <div className="grid-12 items-center gap-y-8">
        <Link href={href} className="group col-span-4 block overflow-hidden rounded-2xl bg-[#F4F4F5] md:col-span-7" tabIndex={-1} aria-hidden>
          {p.image ? (
            <ResponsiveImage
              image={p.image}
              alt=""
              sizes="(min-width: 768px) 50vw, 100vw"
              index={9}
              className="aspect-[4/5] w-full object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03] sm:aspect-[4/3] md:aspect-[5/4]"
            />
          ) : (
            <span className="block aspect-[5/4] w-full" />
          )}
        </Link>
        <div className="reveal col-span-4 grid justify-items-start gap-5 md:col-span-5 md:col-start-8 md:gap-6 lg:col-span-4 lg:col-start-9">
          <span className="t-label section-index">
            {index}
            {eyebrow && <span className="text-st-fg"> — {eyebrow}</span>}
          </span>
          <h2 id="spotlight-h" className="t-display">
            <Link href={href} className="underline-offset-[0.12em] hover:underline">{name}</Link>
          </h2>
          <p className="num flex flex-wrap items-baseline gap-x-3 text-xl">
            <span className="font-medium">{p.priceMax > p.price ? fill(labels.from, { price: formatIQD(p.price, locale) }) : formatIQD(p.price, locale)}</span>
            {isOnSale(p) && <s className="text-base text-muted">{formatIQD(p.compareAtPrice!, locale)}</s>}
          </p>
          {description && <p className="line-clamp-3 max-w-md text-base leading-relaxed text-muted md:text-[17px]">{description}</p>}
          <div className="flex w-full flex-wrap gap-3 sm:w-auto">
            <Link href={href} className="btn-gold min-h-12 flex-1 px-8 sm:flex-none">{labels.view}</Link>
            {!p.hasVariants && !p.soldOut && (
              <AddToCart
                slug={slug}
                productId={p.id}
                labels={{ add: labels.add, added: labels.added, soldOut: labels.soldOut }}
                item={{ name, image: p.image?.url ?? null, price: formatIQD(p.price, locale) }}
                className="btn-ghost min-h-12 flex-1 px-8 sm:flex-none"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Editorial collections index: one hairline row per category — plate number, the name in display type at poster
 * size, product count and a small photo at the inline end. Replaces the photo bento in the Editorial design.
 */
export function CollectionIndex({
  categories,
  products,
  slug,
  locale,
  title,
  index,
  countLabel,
}: {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  slug: string;
  locale: Locale;
  title: string;
  index: string;
  countLabel: (count: number) => string;
}) {
  const rows = categories
    .map((c) => {
      const items = products.filter((p) => p.categoryId === c.id);
      return { c, cover: items.find((p) => p.image)?.image ?? null, count: items.length };
    })
    .filter((r) => r.count > 0)
    .slice(0, 8);
  if (rows.length < 2) return null;
  return (
    <section aria-labelledby="collections-h" className="section grid gap-6 sm:gap-8" data-testid="collections" data-variant="index">
      <SectionHead id="collections-h" title={title} index={index} />
      <ol className="border-t border-st-fg">
        {rows.map(({ c, cover, count }, i) => (
          <li key={c.id} className="reveal border-b border-st-border">
            <Link href={`/s/${slug}?c=${c.id}#products`} className="group flex min-h-20 items-center gap-4 py-4 sm:gap-8 sm:py-6">
              <span className="t-label section-index w-7 shrink-0" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
              <span className="sf-display min-w-0 flex-1 truncate text-3xl leading-tight transition-transform duration-300 ease-out group-hover:translate-x-2 rtl:group-hover:-translate-x-2 sm:text-5xl md:text-6xl">{pickText(c.name, locale)}</span>
              <span className="t-label hidden shrink-0 items-center gap-1.5 text-muted sm:flex">{countLabel(count)}</span>
              {cover && (
                <span className="relative hidden h-20 w-16 shrink-0 overflow-hidden bg-[#F4F4F5] sm:block md:h-24 md:w-20">
                  <ResponsiveImage image={cover} alt="" sizes="80px" index={9} className="absolute inset-0 h-full w-full object-cover" />
                </span>
              )}
              <ArrowForward className="h-5 w-5 shrink-0 transition-transform duration-150 group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Story (design system v2): the seller's own "about" text as a home section. Display face, generous measure; nothing is
 * invented: the section only renders when the seller wrote an about text.
 */
export function StoryBand({ title, body, index }: { title: string; body: string; index: string }) {
  return (
    <section aria-labelledby="story-h" className="section sf-story grid gap-5 border-y border-st-border py-12 sm:py-16 md:grid-cols-12 md:gap-x-[var(--grid-gap)]" data-testid="story">
      <div className="md:col-span-4"><SectionHead id="story-h" title={title} index={index} /></div>
      <p className="sf-display whitespace-pre-line text-balance text-2xl leading-[1.45] sm:text-3xl md:col-span-8 md:col-start-5 md:text-4xl">{body}</p>
    </section>
  );
}

/** Social strip: six product photos in an Instagram-style square grid, the handle and a follow link. */
export function SocialStrip({ instagram, photos, slug, locale, title, body, index }: { instagram: string; photos: CatalogProduct[]; slug: string; locale: Locale; title: string; body: string; index: string }) {
  if (photos.length < 3) return null;
  return (
    <section aria-labelledby="social-h" className="section grid gap-5" data-testid="social-strip">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHead id="social-h" title={title} index={index} />
        <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener noreferrer" className="btn-ghost min-h-11 px-5" dir="ltr">@{instagram}</a>
      </div>
      <p className="-mt-2 text-[15px] text-muted">{body}</p>
      <ul className="grid grid-cols-3 gap-1 sm:grid-cols-6 sm:gap-2">
        {photos.slice(0, 6).map((p, i) => (
          <li key={p.id} className="relative aspect-square overflow-hidden">
            <Link href={`/s/${slug}/p/${p.id}`} className="block h-full w-full" aria-label={pickText(p.name, locale)}>
              {p.image && <ResponsiveImage image={p.image} alt="" sizes="(min-width: 640px) 16vw, 33vw" index={i + 8} className="h-full w-full object-cover transition-transform duration-500 ease-out hover:scale-[1.04] motion-reduce:transition-none" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** WhatsApp band: invite to order or ask by chat; works without JS (a plain link). */
export function WhatsAppBand({ href, title, body, cta, index }: { slug: string; href: string; title: string; body: string; cta: string; index: string }) {
  return (
    <section aria-labelledby="wa-h" className="section sf-wa grid items-center gap-5 rounded-2xl bg-st-surface p-6 ring-1 ring-inset ring-st-border sm:p-10 md:grid-cols-[1fr_auto]" data-testid="whatsapp-band">
      <div className="grid gap-2">
        {index && <span className="t-label section-index" aria-hidden>{index}</span>}
        <h2 id="wa-h" className="t-headline">{title}</h2>
        <p className="text-[15px] leading-relaxed text-muted">{body}</p>
      </div>
      <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-gold min-h-12 px-7">{cta}</a>
    </section>
  );
}
