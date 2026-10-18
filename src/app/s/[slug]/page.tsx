import { InstantSearch } from "@/components/store/InstantSearch";
import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { NONCE_HEADER } from "@/server/csp";
import { absoluteUrl, serializeJsonLd } from "@/lib/product-page";
import { effectiveSeo, siteUrl, storeJsonLd } from "@/lib/seo";
import { normalizePlan } from "@/lib/plans";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { loadStore } from "./data";
import { getCatalog, getProductDetail, getStoreOffers, getStorefrontSettings } from "@/server/cache/storefront";
import { currentLocale } from "@/server/locale";
import { ProductCard } from "@/components/store/ProductCard";
import { pickText } from "@/lib/i18n";
import { formatIQD } from "@/lib/money";
import { filterCatalog } from "@/lib/catalog-filter";
import { waLink } from "@/lib/whatsapp";
import { WaTap } from "@/components/store/WaTap";
import { normalizePhone } from "@/lib/phone";
import { Icon, MessageCircle, Search, Truck, X } from "@/components/ui/icons";
import { ViewPixel } from "@/components/store/ViewPixel";
import { ProductStrip, SectionHead } from "@/components/store/MiniProductCard";
import { CollectionBento, CollectionIndex, Spotlight } from "@/components/store/HomeSections";
import { HeroArch, HeroBanner, HeroFullbleed, HeroMasthead, HeroSplit, HeroStage, HeroType } from "@/components/store/HomeHero";
import { numberSections, type HomeSection } from "@/lib/theme-studio/designs";
import { resolveDesign } from "./design";
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
  const design = await resolveDesign(slug, store.themePublished);
  const t = await getTranslations("store");
  const locale = await currentLocale();
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  const [{ products, categories: usedCats, bestSellers }, { zones }, codes] = await Promise.all([
    getCatalog(store.id),
    getStorefrontSettings(store.id),
    getStoreOffers(store.id),
  ]);
  const { items, total, hasMore, page, outOfRange } = filterCatalog(products, { q, c, offers, page: one(sp.page), locale, pageSize: design.pageSize });
  // ?page=N past the last page: a 404 (the store's own not-found page), never the whole catalogue under a bogus URL.
  if (outOfRange) notFound();
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
  const remaining = Math.min(total - items.length, design.pageSize);

  // Spotlight: the seller's featured product, else something the best-seller set doesn't already show, else the top seller.
  const bestIds = new Set(best.map((p) => p.id));
  const withPhoto = products.filter((p) => p.image && !p.soldOut);
  const spot = browsing && design.sections.includes("spotlight")
    ? (withPhoto.find((p) => p.badge === "featured") ?? withPhoto.find((p) => !bestIds.has(p.id)) ?? withPhoto[0] ?? null)
    : null;
  const spotDetail = spot ? await getProductDetail(store.id, spot.id) : null;
  const spotDescription = spotDetail ? pickText(spotDetail.description, locale).split(/\n+/)[0]?.trim() : undefined;
  const spotEyebrow = spot?.badge === "featured" ? badges.featured : spot?.badge === "new" ? badges.new : spot?.bestSeller ? badges.bestSeller : undefined;

  const showCollections = browsing && usedCats.length >= 2;
  const hasOffersStrip = browsing && !!(offer || minFee !== null);
  const idx = numberSections(design.sections, { collections: showCollections, best: best.length > 0, spotlight: !!spot, sale: saleStrip.length > 0 });
  const allIndex = String(Object.values(idx).filter(Boolean).length + 1).padStart(2, "0");
  const look = design.card;
  const cover = store.coverImageUrl ? { url: store.coverImageUrl, renditions: store.coverImageRenditions, placeholder: store.coverImagePlaceholder } : null;
  const heroProps = { name: store.name, tagline, cover, shopNow: t("shopNow") };

  const gridClass = {
    auto: "grid grid-cols-2 gap-x-[var(--grid-gap)] gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] sm:gap-y-12",
    // Magazine: three columns with generous air; the middle column drops so rows never line up like a table.
    magazine: "grid grid-cols-2 gap-x-4 gap-y-14 sm:gap-x-8 md:grid-cols-3 md:gap-x-10 md:gap-y-20 [&>*:nth-child(even)]:mt-12 md:[&>*:nth-child(even)]:mt-0 md:[&>*:nth-child(3n+2)]:mt-24",
    // Dense: catalogue-first, 2 columns on phones up to 6 on wide desktops.
    // Tiles: edge-to-edge photo tiles separated by a hairline gap, 2 columns on phones up to 4 on desktops.
    tiles: "grid grid-cols-2 gap-0.5 sm:grid-cols-3 lg:grid-cols-4",
    // Soft: roomy rounded cards, 2 columns on phones, 3 from sm, 4 on wide desktops.
    soft: "grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-12 xl:grid-cols-4",
    // Rows: a ledger, one row per product (thumb, name, price, add); two columns of rows from lg.
    rows: "grid grid-cols-1 gap-x-12 border-b-2 border-st-fg lg:grid-cols-2",
    // Masonry: CSS columns of floating cards with uneven photo ratios; 2 columns on phones up to 4 on wide desktops.
    masonry: "columns-2 gap-3 sm:columns-3 sm:gap-5 xl:columns-4 [&>*]:mb-3 [&>*]:break-inside-avoid sm:[&>*]:mb-5",
    dense: "grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 md:gap-x-4 md:gap-y-8 lg:grid-cols-5 xl:grid-cols-6",
  } as const;
  const catItems = [
    { key: "all", href: `${homeHref(slug, { q })}#products`, label: t("all"), on: !c && !offers },
    ...(onSale.length > 0 ? [{ key: "offers", href: `${homeHref(slug, { q, offers: true })}#products`, label: t("offers"), on: offers, testId: "offers-chip" }] : []),
    ...usedCats.map((cat) => ({ key: cat.id, href: `${homeHref(slug, { q, c: cat.id })}#products`, label: pickText(cat.name, locale), on: c === cat.id })),
  ];
  const catCls = {
    classic: (on: boolean) => `${chip} ${on ? chipOn : chipOff}`,
    editorial: (on: boolean) => `sf-display inline-flex min-h-11 items-center border-b-2 text-xl transition-colors duration-150 ${on ? "border-st-fg" : "border-transparent text-muted hover:text-st-fg"}`,
    gallery: (on: boolean) => `inline-flex min-h-11 items-center border-b text-xs font-medium uppercase tracking-[0.14em] transition-colors duration-150 ${on ? "border-st-fg" : "border-transparent text-muted hover:text-st-fg"}`,
    mono: (on: boolean) => `inline-flex min-h-11 shrink-0 items-center border-2 border-st-fg px-4 text-xs font-bold uppercase tracking-[0.08em] transition-colors duration-150 ${on ? "bg-st-fg text-st-bg" : "bg-transparent text-st-fg hover:bg-st-fg/10"}`,
    studio: (on: boolean) => `inline-flex min-h-11 shrink-0 items-center rounded-full px-5 text-sm font-semibold transition-colors duration-150 ${on ? "bg-st-accent text-st-on-accent" : "bg-st-surface text-st-fg ring-1 ring-inset ring-st-border hover:ring-st-fg/40"}`,
    market: (on: boolean) => `inline-flex min-h-11 shrink-0 items-center rounded-lg px-4 text-sm font-medium transition-colors duration-150 ${on ? "bg-st-fg text-st-bg" : "bg-st-surface text-st-fg ring-1 ring-inset ring-st-border hover:ring-st-fg/40"}`,
  } as const;
  const catNav =
    usedCats.length > 0 || onSale.length > 0
      ? catItems.map((it) => (
          <Link key={it.key} href={it.href} aria-current={it.on ? "page" : undefined} className={catCls[design.id === "editorial" ? "editorial" : design.id === "market" ? "market" : design.id === "gallery" ? "gallery" : design.id === "mono" ? "mono" : design.id === "studio" ? "studio" : "classic"](it.on)} data-testid={"testId" in it ? it.testId : undefined}>
            {it.label}
          </Link>
        ))
      : null;
  const blocks: Record<HomeSection, ReactNode> = {
    offers: hasOffersStrip && (
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
    ),
    collections:
      showCollections &&
      (design.id === "editorial" ? (
        <CollectionIndex categories={usedCats} products={products} slug={store.slug} locale={locale} title={t("collections")} index={idx.collections} countLabel={(count) => t("itemsCount", { count })} />
      ) : (
        <CollectionBento categories={usedCats} products={products} slug={store.slug} locale={locale} title={t("collections")} index={idx.collections} countLabel={(count) => t("itemsCount", { count })} />
      )),
    best: (
      <ProductStrip id="best-h" title={t("bestSellers")} index={idx.best} products={best} slug={store.slug} locale={locale} labels={badges} from={from} view={t("view")} testId="best-sellers" look={look} />
    ),
    spotlight:
      spot && (
        <Spotlight
          p={spot}
          slug={store.slug}
          locale={locale}
          index={idx.spotlight}
          eyebrow={spotEyebrow}
          description={spotDescription}
          labels={{ view: t("view"), add: t("addToCart"), added: t("added"), soldOut: t("outOfStock"), from }}
        />
      ),
    sale: (
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
        look={look}
      />
    ),
    rail: null,
  };

  return (
    // Room under the last block so the floating chat button (390/360) never sits on top of it at the end of the page.
    <div className={wa ? "grid pb-20 sm:pb-0" : "grid"}>
      <ViewPixel slug={store.slug} />
      {browsing && <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: serializeJsonLd(storeJsonLd({
        name: store.name,
        url: `${siteUrl()}/s/${store.slug}`,
        description: effectiveSeo(normalizePlan(store.plan), store.seo).description || pickText(store.tagline, locale) || undefined,
        logo: store.logoUrl ? absoluteUrl(siteUrl(), store.logoUrl) : null,
        image: store.coverImageUrl ? absoluteUrl(siteUrl(), store.coverImageUrl) : null,
        telephone: store.phone,
        city: store.city,
        sameAs: store.instagram ? [`https://instagram.com/${store.instagram}`] : [],
      })) }} />}
      {browsing && (
        <>
          {design.hero === "masthead" ? <HeroMasthead {...heroProps} /> : design.hero === "banner" ? <HeroBanner {...heroProps} /> : design.hero === "fullbleed" ? <HeroFullbleed {...heroProps} /> : design.hero === "arch" ? <HeroArch {...heroProps} /> : design.hero === "type" ? <HeroType {...heroProps} /> : design.hero === "stage" ? <HeroStage {...heroProps} /> : <HeroSplit {...heroProps} />}
          {design.sections.map((k) => (
            <Fragment key={k}>{blocks[k]}</Fragment>
          ))}
        </>
      )}

      {/* All products: heading, then category links (start) and search (end) on one row from md up. */}
      <section id="products" aria-labelledby="grid-h" className={`grid scroll-mt-24 gap-6 sm:gap-8 ${browsing ? "section" : ""}`} data-grid={design.grid}>
        <SectionHead id="grid-h" title={offers ? t("offers") : t("allProducts")} index={browsing && design.id !== "market" ? allIndex : undefined} testId="grid-title" />
        {catNav && design.id === "market" && (
          <div className="rail sticky top-16 z-10 -mx-[var(--page-margin)] overflow-x-auto border-b border-st-border bg-st-bg/95 px-[var(--page-margin)] py-2 backdrop-blur" data-testid="category-rail">
            <nav className="flex gap-2" aria-label={t("products")}>{catNav}</nav>
          </div>
        )}
        <div className="grid-12 gap-y-4">
          {catNav && design.id !== "market" && (
            <nav
              className={`col-span-4 md:col-span-8 ${design.id === "editorial" ? "flex flex-wrap gap-x-7 gap-y-1" : "rail -mx-[var(--page-margin)] flex gap-2 overflow-x-auto px-[var(--page-margin)] md:mx-0 md:flex-wrap md:px-0"}`}
              aria-label={t("products")}
            >
              {catNav}
            </nav>
          )}
          {/* Plain GET form: works without JS, keeps the category. */}
          <form id="store-search" action={`/s/${slug}#products`} method="get" role="search" className={`col-span-4 flex items-center md:col-span-4 md:col-start-9 ${design.id === "market" ? "md:hidden" : ""}`}>
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
                className={`h-12 w-full border border-st-border bg-st-surface ps-11 pe-4 text-base text-st-fg transition-[border-color] duration-150 placeholder:text-faint hover:border-st-fg/40 focus:border-st-fg focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${design.id === "classic" || design.id === "studio" ? "rounded-full" : design.id === "editorial" ? "rounded-none" : "rounded-lg"}`}
              />
            </label>
            <button type="submit" className="sr-only">{t("search")}</button>
            <InstantSearch formId="store-search" />
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
          <div className={gridClass[design.grid]} data-testid="product-grid">
            {items.map((p, i) => (
              <div key={p.id} id={`p${i}`} className="scroll-mt-24">
                <ProductCard p={p} slug={store.slug} locale={locale} index={browsing ? i + 2 : i} labels={cardLabels} variant={look} number={String(i + 1).padStart(2, "0")} />
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
          revealOnScroll
          href={waLink(wa, t("waStoreIntro", { store: store.name }))}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("chatWhatsApp")}
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] start-[calc(1rem+env(safe-area-inset-left))] z-30 flex h-12 min-w-12 items-center justify-center gap-2 rounded-full border border-st-fg bg-st-surface px-3.5 text-[15px] font-medium text-st-fg shadow-e3 hover:bg-st-bg sm:px-5 rtl:start-[calc(1rem+env(safe-area-inset-right))]"
        >
          <Icon as={MessageCircle} className="h-5 w-5" />
          <span className="hidden sm:inline">{t("chatWhatsApp")}</span>
        </WaTap>
      )}
    </div>
  );
}
