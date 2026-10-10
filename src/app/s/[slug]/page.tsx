import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { loadStore } from "./data";
import { getCatalog, getStoreOffers, getStorefrontSettings } from "@/server/cache/storefront";
import { currentLocale } from "@/server/locale";
import { ProductCard } from "@/components/store/ProductCard";
import { pickText } from "@/lib/i18n";
import { formatIQD } from "@/lib/money";
import { filterCatalog, DEFAULT_PAGE_SIZE } from "@/lib/catalog-filter";
import { waLink } from "@/lib/whatsapp";
import { WaTap } from "@/components/store/WaTap";
import { buildSrcSet, SIZES } from "@/lib/responsive-image";
import { normalizePhone } from "@/lib/phone";
import { Icon, MessageCircle, Search, Truck, X } from "@/components/ui/icons";
import { ViewPixel } from "@/components/store/ViewPixel";
import { ProductStrip, SectionHead } from "@/components/store/MiniProductCard";
import { OfferBanner } from "@/components/store/OfferBanner";
import { bestSellerStrip, pickBannerOffer, saleProducts } from "@/lib/merch";
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
  // Merchandising strips only on the plain store home (not while searching, filtering or paging).
  const browsing = !q && !c && !offers && page === 1;
  const best = browsing ? bestSellerStrip(products, bestSellers) : [];
  const saleStrip = browsing ? onSale.slice(0, 8) : [];
  const minFee = zones.length ? Math.min(...zones.map((z) => z.fee)) : null;
  const tagline = pickText(store.tagline, locale);
  const wa = store.whatsapp ? normalizePhone(store.whatsapp) : null;
  const remaining = Math.min(total - items.length, DEFAULT_PAGE_SIZE);

  return (
    <div className="grid gap-6">
      <ViewPixel slug={store.slug} />
      {/* Hero: the store name in big light display type, one line of tagline, one ink pill; the cover photo below. */}
      <section className="mb-6 grid gap-8 sm:mb-12 sm:gap-12" data-testid="store-hero">
        <div className="grid max-w-4xl justify-items-start gap-4 sm:gap-6">
          <h1 className="display break-words text-[44px] sm:text-[64px] lg:text-[88px]">{store.name}</h1>
          {tagline && <p className="line-clamp-2 max-w-xl text-[17px] leading-snug text-muted sm:text-xl">{tagline}</p>}
          <a href="#products" className="btn-gold mt-1 min-h-12 px-7">{t("shopNow")}</a>
        </div>
        {store.coverImageUrl && (
          <div className="overflow-hidden rounded-2xl bg-[#F4F4F5]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={store.coverImageUrl}
              srcSet={buildSrcSet(store.coverImageRenditions)}
              sizes={store.coverImageRenditions?.length ? SIZES.cover : undefined}
              alt=""
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="aspect-[4/3] w-full object-cover sm:aspect-[21/9]"
              style={store.coverImagePlaceholder ? { backgroundImage: `url("${store.coverImagePlaceholder}")`, backgroundSize: "cover" } : undefined}
            />
          </div>
        )}
      </section>

      {(offer || minFee !== null) && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-y border-st-border py-2 text-sm">
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

      {/* Plain GET form: works without JS, keeps the category. */}
      <form id="products" action={`/s/${slug}`} method="get" role="search" className="flex scroll-mt-24 items-center gap-2">
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

      {(usedCats.length > 0 || onSale.length > 0) && (
        <nav className="rail -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" aria-label={t("products")}>
          <Link href={homeHref(slug, { q })} aria-current={!c && !offers ? "page" : undefined} className={`${chip} ${!c && !offers ? chipOn : chipOff}`}>{t("all")}</Link>
          {onSale.length > 0 && (
            <Link
              href={homeHref(slug, { q, offers: true })}
              aria-current={offers ? "page" : undefined}
              className={`${chip} ${offers ? chipOn : chipOff}`}
              data-testid="offers-chip"
            >
              {t("offers")}
            </Link>
          )}
          {usedCats.map((cat) => (
            <Link key={cat.id} href={homeHref(slug, { q, c: cat.id })} aria-current={c === cat.id ? "page" : undefined} className={`${chip} ${c === cat.id ? chipOn : chipOff}`}>
              {pickText(cat.name, locale)}
            </Link>
          ))}
        </nav>
      )}

      {q && (
        <p className="flex items-center justify-between gap-2 text-sm text-muted" aria-live="polite">
          <span>{t("resultsFor", { q, count: total })}</span>
          <Link href={homeHref(slug, { c, offers })} className="inline-flex min-h-11 items-center gap-1 font-medium text-st-fg underline underline-offset-4">
            <Icon as={X} /> {t("clearSearch")}
          </Link>
        </p>
      )}

      <ProductStrip
        id="best-h"
        title={t("bestSellers")}
        products={best}
        slug={store.slug}
        locale={locale}
        labels={badges}
        from={from}
        testId="best-sellers"
      />
      <ProductStrip
        id="offers-h"
        title={t("offersTitle")}
        products={saleStrip}
        slug={store.slug}
        locale={locale}
        labels={badges}
        from={from}
        seeAll={onSale.length > 1 ? { href: homeHref(slug, { offers: true }), label: t("seeAll") } : undefined}
        testId="offers-strip"
      />
      {(best.length > 0 || saleStrip.length > 0 || offers) && items.length > 0 && (
        <div className="mt-8 sm:mt-14"><SectionHead title={offers ? t("offers") : t("allProducts")} testId="grid-title" /></div>
      )}

      {items.length === 0 ? (
        <p className="border-y border-st-border py-12 text-center text-muted">{q ? t("noResults", { q }) : offers ? t("noOffers") : t("noProducts")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] sm:gap-x-5 sm:gap-y-12">
          {items.map((p, i) => (
            <div key={p.id} id={`p${i}`} className="scroll-mt-24">
              <ProductCard p={p} slug={store.slug} locale={locale} index={i} labels={cardLabels} />
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
