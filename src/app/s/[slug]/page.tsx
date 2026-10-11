import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { loadStore } from "./data";
import { getCatalog, getProductDetail, getStoreOffers, getStorefrontSettings } from "@/server/cache/storefront";
import { currentLocale } from "@/server/locale";
import { ProductCard } from "@/components/store/ProductCard";
import { pickText } from "@/lib/i18n";
import { formatIQD } from "@/lib/money";
import { filterCatalog, DEFAULT_PAGE_SIZE } from "@/lib/catalog-filter";
import { waLink } from "@/lib/whatsapp";
import { WaTap } from "@/components/store/WaTap";
import { buildSrcSet } from "@/lib/responsive-image";
import { normalizePhone } from "@/lib/phone";
import { Icon, MessageCircle, Search, Truck, X } from "@/components/ui/icons";
import { ViewPixel } from "@/components/store/ViewPixel";
import { ProductStrip, SectionHead } from "@/components/store/MiniProductCard";
import { CollectionBento, Spotlight } from "@/components/store/HomeSections";
import { OfferBanner } from "@/components/store/OfferBanner";
import { bestSellerStrip, percentOff, pickBannerOffer, saleProducts } from "@/lib/merch";
import { merchLabels, offerLabels } from "@/components/store/merch-labels";

type SP = { c?: string | string[]; q?: string | string[]; page?: string | string[]; offers?: string | string[] };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** Build a store-home href keeping only the params that are set. */
function homeHref(slug: string, p: { q?: string; c?: string; page?: number; offers?: boolean }) {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.c) sp.set("c", p.c);
  if (p.offers) sp.set("offers", "1");
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  const s = sp.toString();
  return `/s/${slug}${s ? `?${s}` : ""}`;
}

const chip = "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.98]";
const chipOn = "border-st-fg bg-st-fg text-st-bg";
const chipOff = "border-st-border bg-transparent text-st-fg hover:border-st-fg";
const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Store home, Layout v3 "Composed Commerce" (docs/LAYOUT-V3.md §4): asymmetric hero → utility strip → collections
 * bento → best sellers → spotlight band (full bleed) → on sale → all products. While searching, filtering or paging
 * only the product block renders, straight under the header. Sections number themselves (01, 02…) in render order.
 */
export default async function StorefrontPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80);
  const c = one(sp.c);
  const offers = one(sp.offers) === "1";
  const store = await loadStore(slug);
  const t = await getTranslations("store");
  const locale = await currentLocale();
  const [{ products, categories: usedCats, bestSellers }, { zones }, codes] = await Promise.all([
    getCatalog(store.id),
    getStorefrontSettings(store.id),
    getStoreOffers(store.id),
  ]);
  const { items, total, hasMore, page } = filterCatalog(products, { q, c, offers, page: one(sp.page), locale, pageSize: DEFAULT_PAGE_SIZE });
  const badges = merchLabels(t);
  const from = t.raw("from") as string;
  const cardLabels = {
    add: t("addToCart"),
    added: t("added"),
    soldOut: t("outOfStock"),
    chooseOptions: t("chooseOptions"),
    from,
    onlyLeft: t.raw("onlyLeft") as string,
    badges,
  };
  const offer = pickBannerOffer(codes);
  const onSale = saleProducts(products);
  const maxPct = Math.max(0, ...onSale.map((p) => percentOff(p.price, p.compareAtPrice) ?? 0));
  // Editorial sections only on the plain store home (not while searching, filtering or paging).
  const browsing = !q && !c && !offers && page === 1;
  const best = browsing ? bestSellerStrip(products, bestSellers) : [];
  const saleStrip = browsing ? onSale.slice(0, 8) : [];
  const minFee = zones.length ? Math.min(...zones.map((z) => z.fee)) : null;
  const tagline = pickText(store.tagline, locale);
  const wa = store.whatsapp ? normalizePhone(store.whatsapp) : null;
  const remaining = Math.min(total - items.length, DEFAULT_PAGE_SIZE);

  // Spotlight: the seller's featured product, else something the best-seller set doesn't already show, else the top seller.
  const bestIds = new Set(best.map((p) => p.id));
  const withPhoto = products.filter((p) => p.image && !p.soldOut);
  const spot = browsing
    ? (withPhoto.find((p) => p.badge === "featured") ?? withPhoto.find((p) => !bestIds.has(p.id)) ?? withPhoto[0] ?? null)
    : null;
  const spotDetail = spot ? await getProductDetail(store.id, spot.id) : null;
  const spotDescription = spotDetail ? pickText(spotDetail.description, locale).split(/\n+/)[0]?.trim() : undefined;
  const spotEyebrow = spot?.badge === "featured" ? badges.featured : spot?.badge === "new" ? badges.new : spot?.bestSeller ? badges.bestSeller : undefined;

  const showCollections = browsing && usedCats.length >= 2;
  let n = 0;
  const idx = { collections: showCollections ? pad2(++n) : "", best: best.length ? pad2(++n) : "", spot: spot ? pad2(++n) : "", sale: saleStrip.length ? pad2(++n) : "", all: pad2(++n) };

  return (
    <div className="grid">
      <ViewPixel slug={store.slug} />
      {browsing && (
        <>
          {/* Asymmetric hero (§4.1): photo on the inline end bleeding to the viewport edge; the store name starts on
              the grid's first column and runs over the photo on canvas-coloured plates, so it reads on any photo. */}
          <section className="grid-12 -mt-6 items-end sm:-mt-10 md:mt-0" data-testid="store-hero">
            {store.coverImageUrl && (
              <div className="bleed-x col-span-4 overflow-hidden bg-[#F4F4F5] md:col-span-7 md:col-start-6 md:row-start-1 md:ms-0 md:bleed-end md:rounded-s-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={store.coverImageUrl}
                  srcSet={buildSrcSet(store.coverImageRenditions)}
                  sizes={store.coverImageRenditions?.length ? "(min-width: 768px) 62vw, 100vw" : undefined}
                  alt=""
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  className="aspect-[4/5] w-full object-cover sm:aspect-[4/3] md:aspect-auto md:h-[min(72vh,40rem)]"
                  style={store.coverImagePlaceholder ? { backgroundImage: `url("${store.coverImagePlaceholder}")`, backgroundSize: "cover" } : undefined}
                />
              </div>
            )}
            {/* Name, tagline and CTA as one block, vertically centred against the photo (no tagline floating at the
                top with the name pinned to the bottom and air in between). */}
            <div
              className={`relative z-[1] col-span-4 grid justify-items-start gap-5 md:gap-7 ${
                store.coverImageUrl ? "-mt-8 md:col-span-8 md:col-start-1 md:row-start-1 md:mt-0 md:self-center md:py-10" : "md:col-span-10 md:py-16"
              }`}
            >
              <h1 className="t-hero break-words">
                <span className="hero-plate">{store.name}</span>
              </h1>
              {tagline && <p className="line-clamp-2 max-w-md text-[17px] leading-snug text-muted md:text-xl">{tagline}</p>}
              <a href="#products" className="btn-gold min-h-12 w-full px-8 sm:w-auto">{t("shopNow")}</a>
            </div>
          </section>

          {(offer || minFee !== null) && (
            <div className="section flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-y border-st-border py-2 text-[15px] md:!mt-12">
              {offer && <OfferBanner offer={offer} locale={locale} labels={offerLabels(t)} />}
              {minFee !== null && (
                <p className="flex min-h-11 items-center gap-2 text-muted">
                  <Icon as={Truck} className="shrink-0" />
                  <span>
                    {minFee === 0 ? t("freeDelivery") : t("deliveryFrom", { fee: formatIQD(minFee, locale) })}
                    {store.freeDeliveryThreshold ? ` · ${t("freeDeliveryOver", { amount: formatIQD(store.freeDeliveryThreshold, locale) })}` : null}
                  </span>
                </p>
              )}
            </div>
          )}

          {showCollections && (
            <CollectionBento
              categories={usedCats}
              products={products}
              slug={store.slug}
              locale={locale}
              title={t("collections")}
              index={idx.collections}
              countLabel={(count) => t("itemsCount", { count })}
            />
          )}

          <ProductStrip
            id="best-h"
            title={t("bestSellers")}
            index={idx.best}
            products={best}
            slug={store.slug}
            locale={locale}
            labels={badges}
            from={from}
            view={t("view")}
            testId="best-sellers"
          />

          {spot && (
            <Spotlight
              p={spot}
              slug={store.slug}
              locale={locale}
              index={idx.spot}
              eyebrow={spotEyebrow}
              description={spotDescription}
              labels={{ view: t("view"), add: t("addToCart"), added: t("added"), soldOut: t("outOfStock"), from }}
            />
          )}

          <ProductStrip
            id="offers-h"
            title={t("offersTitle")}
            index={idx.sale}
            products={saleStrip}
            slug={store.slug}
            locale={locale}
            labels={badges}
            from={from}
            view={t("view")}
            seeAll={onSale.length > 1 ? { href: homeHref(slug, { offers: true }), label: t("seeAll") } : undefined}
            note={maxPct ? t("upToOff", { pct: String(maxPct) }) : undefined}
            testId="offers-strip"
          />
        </>
      )}

      {/* All products: heading, then chips (start) and search (end) on one row from md up. */}
      <section id="products" aria-labelledby="grid-h" className={`grid scroll-mt-24 gap-6 sm:gap-8 ${browsing ? "section" : ""}`}>
        <SectionHead id="grid-h" title={offers ? t("offers") : t("allProducts")} index={browsing ? idx.all : undefined} testId="grid-title" />
        <div className="grid-12 gap-y-4">
          {(usedCats.length > 0 || onSale.length > 0) && (
            <nav className="rail col-span-4 -mx-[var(--page-margin)] flex gap-2 overflow-x-auto px-[var(--page-margin)] md:col-span-8 md:mx-0 md:flex-wrap md:px-0" aria-label={t("products")}>
              <Link href={`${homeHref(slug, { q })}#products`} aria-current={!c && !offers ? "page" : undefined} className={`${chip} ${!c && !offers ? chipOn : chipOff}`}>{t("all")}</Link>
              {onSale.length > 0 && (
                <Link
                  href={`${homeHref(slug, { q, offers: true })}#products`}
                  aria-current={offers ? "page" : undefined}
                  className={`${chip} ${offers ? chipOn : chipOff}`}
                  data-testid="offers-chip"
                >
                  {t("offers")}
                </Link>
              )}
              {usedCats.map((cat) => (
                <Link key={cat.id} href={`${homeHref(slug, { q, c: cat.id })}#products`} aria-current={c === cat.id ? "page" : undefined} className={`${chip} ${c === cat.id ? chipOn : chipOff}`}>
                  {pickText(cat.name, locale)}
                </Link>
              ))}
            </nav>
          )}
          {/* Plain GET form: works without JS, keeps the category. */}
          <form action={`/s/${slug}#products`} method="get" role="search" className="col-span-4 flex items-center md:col-span-4 md:col-start-9">
            {c && <input type="hidden" name="c" value={c} />}
            {offers && <input type="hidden" name="offers" value="1" />}
            <label className="relative flex-1">
              <span className="sr-only">{t("search")}</span>
              <Icon as={Search} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder={t("searchPlaceholder")}
                enterKeyHint="search"
                maxLength={80}
                className="h-12 w-full rounded-full border border-st-border bg-st-surface ps-11 pe-4 text-base text-st-fg transition-[border-color] duration-150 placeholder:text-faint hover:border-st-fg/40 focus:border-st-fg focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
              />
            </label>
            <button type="submit" className="sr-only">{t("search")}</button>
          </form>
        </div>

        {q && (
          <p className="flex items-center justify-between gap-2 text-sm text-muted" aria-live="polite">
            <span>{t("resultsFor", { q, count: total })}</span>
            <Link href={`${homeHref(slug, { c, offers })}#products`} className="inline-flex min-h-11 items-center gap-1 font-medium text-st-fg underline underline-offset-4">
              <Icon as={X} /> {t("clearSearch")}
            </Link>
          </p>
        )}

        {items.length === 0 ? (
          <div className="grid justify-items-center gap-6 border-y border-st-border px-4 py-16 text-center sm:py-24" data-testid="empty-results">
            <p className="t-headline max-w-xl break-words">{q ? t("noResults", { q }) : offers ? t("noOffers") : t("noProducts")}</p>
            {(q || c || offers) && (
              <Link href={`${homeHref(slug, {})}#products`} className="btn-ghost min-h-12 px-7">
                {q ? t("clearSearch") : t("all")}
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-[var(--grid-gap)] gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] sm:gap-y-12">
            {items.map((p, i) => (
              <div key={p.id} id={`p${i}`} className="scroll-mt-24">
                <ProductCard p={p} slug={store.slug} locale={locale} index={browsing ? i + 2 : i} labels={cardLabels} />
              </div>
            ))}
          </div>
        )}

        {hasMore && (
          <Link
            href={`${homeHref(slug, { q, c, offers, page: page + 1 })}#p${items.length}`}
            scroll={false}
            className="btn-ghost mx-auto mt-2 min-h-12 px-7"
          >
            {t("showMore", { count: remaining })}
          </Link>
        )}
      </section>

      {wa && (
        <WaTap
          slug={slug}
          href={waLink(wa, t("waStoreIntro", { store: store.name }))}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("chatWhatsApp")}
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] start-[calc(1rem+env(safe-area-inset-left))] z-30 flex h-12 min-w-12 items-center justify-center gap-2 rounded-full border border-st-fg bg-st-surface px-3.5 text-[15px] font-medium text-st-fg shadow-e3 transition-colors duration-150 hover:bg-st-bg sm:px-5 rtl:start-[calc(1rem+env(safe-area-inset-right))]"
        >
          <Icon as={MessageCircle} className="h-5 w-5" />
          <span className="hidden sm:inline">{t("chatWhatsApp")}</span>
        </WaTap>
      )}
    </div>
  );
}
