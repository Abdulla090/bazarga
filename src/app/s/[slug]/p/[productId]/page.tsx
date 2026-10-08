import Link from "next/link";
import { ViewPixel } from "@/components/store/ViewPixel";
import { cookies, headers } from "next/headers";
import { pickDeliveryZone, shopperCityCookie } from "@/lib/shopper-city";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { loadStore } from "../../data";
import { getCatalog, getProductDetail, getStoreOffers, getStorefrontSettings } from "@/server/cache/storefront";
import { currentLocale } from "@/server/locale";
import { env } from "@/server/env";
import { NONCE_HEADER } from "@/server/csp";
import { pickText } from "@/lib/i18n";
import { formatIQD } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import { waLink } from "@/lib/whatsapp";
import { WaTap } from "@/components/store/WaTap";
import {
  absoluteUrl,
  descriptionParagraphs,
  productJsonLd,
  relatedProducts,
  serializeJsonLd,
  specRows,
} from "@/lib/product-page";
import { ProductGallery } from "@/components/store/ProductGallery";
import { ProductBuy, type BuyLabels } from "@/components/store/ProductBuy";
import { DeliveryInfo, etaText } from "@/components/store/DeliveryInfo";
import { ProductStrip } from "@/components/store/MiniProductCard";
import { MerchBadges } from "@/components/store/MerchBadges";
import { OfferBanner } from "@/components/store/OfferBanner";
import { merchLabels, offerLabels } from "@/components/store/merch-labels";
import { pickBannerOffer } from "@/lib/merch";
import { ArrowBack, Banknote, Icon, MessageCircle, Truck, Undo2 } from "@/components/ui/icons";

/** Descriptions longer than this (or with more than two paragraphs) start clamped with a "Read more" toggle. */
const LONG_DESCRIPTION = 280;
const moreLink =
  "inline-flex min-h-11 w-fit cursor-pointer items-center text-sm font-bold text-st-fg underline underline-offset-4 peer-focus-visible:outline-2 peer-focus-visible:outline-st-accent";

async function load(slug: string, productId: string) {
  if (!z.uuid().safeParse(productId).success) notFound();
  const store = await loadStore(slug);
  const p = await getProductDetail(store.id, productId);
  if (!p) notFound();
  return { store, p };
}

const base = () => env().APP_URL.replace(/\/$/, "");

export async function generateMetadata({ params }: { params: Promise<{ slug: string; productId: string }> }): Promise<Metadata> {
  const { slug, productId } = await params;
  const { store, p } = await load(slug, productId);
  const locale = await currentLocale();
  const title = `${pickText(p.name, locale)} · ${store.name}`;
  const description = pickText(p.description, locale).replace(/\s+/g, " ").slice(0, 160);
  const cover = p.images[0];
  const url = `${base()}/s/${store.slug}/p/${p.id}`;
  const og = cover
    ? [{ url: absoluteUrl(base(), cover.url), width: cover.width ?? undefined, height: cover.height ?? undefined, alt: pickText(p.name, locale) }]
    : undefined;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: store.name, type: "website", images: og },
    twitter: { card: cover ? "summary_large_image" : "summary", title, description, images: og?.map((i) => i.url) },
  };
}

/** Whole trust tile is the tap target (≥ 44 px). */
const trustLink = "flex min-h-11 w-full items-start gap-2 rounded-xl border border-st-border bg-st-surface p-3";
const section = "group rounded-[var(--radius-card)] border border-st-border bg-st-surface";
const summary =
  "flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-bold [&::-webkit-details-marker]:hidden";
const chevron = (
  <span aria-hidden className="text-lg leading-none text-st-muted transition-transform group-open:rotate-180">
    ⌄
  </span>
);

export default async function ProductPage({ params }: { params: Promise<{ slug: string; productId: string }> }) {
  const { slug, productId } = await params;
  const { store, p } = await load(slug, productId);
  const [settings, catalog, codes, t, tc, locale, nonce] = await Promise.all([
    getStorefrontSettings(store.id),
    getCatalog(store.id),
    getStoreOffers(store.id),
    getTranslations("store"),
    getTranslations("common"),
    currentLocale(),
    headers().then((h) => h.get(NONCE_HEADER) ?? undefined),
  ]);
  const name = pickText(p.name, locale);
  const description = pickText(p.description, locale);
  const paragraphs = descriptionParagraphs(description);
  const specs = specRows(p.specs, locale);
  const returnPolicy = pickText(store.returnPolicy, locale);
  const labels: BuyLabels = {
    addToCart: t("addToCart"),
    added: t("added"),
    soldOut: t("outOfStock"),
    buyNow: t("buyNow"),
    choose: t.raw("choose") as string,
    onlyLeft: t.raw("onlyLeft") as string,
    from: t.raw("from") as string,
    askWhatsApp: t("askWhatsApp"),
    share: t("share"),
    linkCopied: t("linkCopied"),
    waIntro: t("waIntro", { store: store.name }),
    unavailable: t("unavailable"),
    inStock: t("inStock"),
    soldOutStatus: t("soldOutStatus"),
    skuLabel: t("skuLabel"),
    quantity: t("quantity"),
    decrease: t("decrease"),
    increase: t("increase"),
    percentOff: t.raw("percentOff") as string,
    youSave: t.raw("youSave") as string,
  };
  const badges = merchLabels(t);
  const offer = pickBannerOffer(codes);
  const longDescription = description.length > LONG_DESCRIPTION || paragraphs.length > 2;
  const shareUrl = `${base()}/s/${store.slug}/p/${p.id}`;
  const wa = normalizePhone(store.whatsapp ?? store.phone ?? "");

  // Trust row: delivery to the home city (the checkout's default city) with fee + ETA.
  const rememberedCity = (await cookies()).get(shopperCityCookie(store.slug))?.value;
  const home = pickDeliveryZone(settings.zones, rememberedCity, store.city);
  const tt = t as unknown as (k: string, v?: Record<string, number>) => string;
  const homeEta = home ? etaText(tt, home.etaMinDays, home.etaMaxDays) : null;
  const homeFee = home ? (home.fee === 0 ? t("free") : formatIQD(home.fee, locale)) : null;

  // Catalog entry carries the computed price range / sold-out state used by the JSON-LD and related strip.
  const self = catalog.products.find((c) => c.id === p.id);
  const related = relatedProducts(catalog.products, { id: p.id, categoryId: p.categoryId }, 8);
  const jsonLd = productJsonLd({
    url: shareUrl,
    name,
    description,
    images: p.images.slice(0, 5).map((i) => absoluteUrl(base(), i.url)),
    sku: p.sku,
    storeName: store.name,
    price: self?.price ?? p.price,
    priceMax: self?.priceMax,
    soldOut: self?.soldOut ?? (p.stock !== null && p.stock <= 0),
  });

  return (
    // Bottom padding on phones so the sticky buy bar never covers the footer.
    <div className="grid gap-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <ViewPixel slug={store.slug} productId={p.id} />
      <Link href={`/s/${store.slug}`} className="-mb-4 inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-st-muted md:-mb-2">
        <ArrowBack /> {tc("back")}
      </Link>
      <div className="grid gap-5 md:grid-cols-2 md:gap-10">
        <div className="relative min-w-0 md:sticky md:top-24 md:h-fit">
          <ProductGallery
            images={p.images}
            alt={name}
            label={{
              photo: t("photo"),
              of: t("of"),
              open: t.raw("openPhoto") as string,
              close: t("closeViewer"),
              next: t("nextPhoto"),
              prev: t("prevPhoto"),
              zoom: t("zoom"),
            }}
          />
          {/* Best seller / New / Featured on the photo (the % off sits next to the price). */}
          <MerchBadges price={p.price} compareAtPrice={null} bestSeller={!!self?.bestSeller} badge={self?.badge ?? null} labels={badges} size="md" corner="left" />
        </div>
        <div className="grid h-fit min-w-0 gap-5">
          <ProductBuy
            slug={store.slug}
            productId={p.id}
            name={name}
            basePrice={p.price}
            baseCompareAt={p.compareAtPrice}
            baseStock={p.stock}
            sku={p.sku}
            options={p.options.map((o) => ({
              id: o.id,
              name: pickText(o.name, locale),
              values: o.values.map((v) => ({ id: v.id, label: pickText(v.label, locale), swatch: v.swatch })),
            }))}
            variants={p.variants}
            locale={locale}
            whatsapp={store.whatsapp ?? store.phone}
            shareUrl={shareUrl}
            labels={labels}
            title={<h1 className="text-2xl font-extrabold leading-tight sm:text-3xl" data-testid="product-name">{name}</h1>}
            info={
              paragraphs.length > 0 ? (
                <div className="grid gap-1" data-testid="product-summary">
                  {longDescription ? (
                    <>
                      {/* CSS-only "Read more": no client JS; the checkbox is the toggle, the label its visible control. */}
                      <input type="checkbox" id="desc-more" className="peer sr-only" />
                      <div className="line-clamp-4 leading-relaxed text-st-muted peer-checked:line-clamp-none [&>p+p]:mt-2" data-testid="summary-text">
                        <DescriptionText paragraphs={paragraphs} />
                      </div>
                      <label htmlFor="desc-more" className={`${moreLink} peer-checked:hidden`} data-testid="read-more">
                        {t("readMore")}
                      </label>
                      <label htmlFor="desc-more" className={`${moreLink} hidden peer-checked:inline-flex`}>
                        {t("readLess")}
                      </label>
                    </>
                  ) : (
                    <div className="leading-relaxed text-st-muted [&>p+p]:mt-2" data-testid="summary-text">
                      <DescriptionText paragraphs={paragraphs} />
                    </div>
                  )}
                </div>
              ) : null
            }
          />

          {/* Trust row */}
          <ul className="grid grid-cols-2 gap-2 text-sm" data-testid="trust-row">
            <li className="flex items-start gap-2 rounded-xl border border-st-border bg-st-surface p-3">
              <Icon as={Banknote} className="mt-0.5 shrink-0 text-st-accent" />
              <span className="font-semibold">{t("trustCod")}</span>
            </li>
            {home && homeFee && (
              <li className="flex items-start gap-2 rounded-xl border border-st-border bg-st-surface p-3">
                <Icon as={Truck} className="mt-0.5 shrink-0 text-st-accent" />
                <span className="font-semibold">
                  {homeEta
                    ? t("trustDeliveryEta", { city: pickText(home.name, locale), fee: homeFee, eta: homeEta })
                    : t("trustDelivery", { city: pickText(home.name, locale), fee: homeFee })}
                </span>
              </li>
            )}
            <li className="flex">
              <a href="#delivery-returns" className={`${trustLink} hover:border-st-fg`}>
                <Icon as={Undo2} className="mt-0.5 shrink-0 text-st-accent" />
                <span className="font-semibold">{returnPolicy ? t("trustReturns") : t("trustNoReturns")}</span>
              </a>
            </li>
            {wa && (
              <li className="flex">
                <WaTap
                  slug={slug}
                  href={waLink(wa, [t("waIntro", { store: store.name }), name, shareUrl].join("\n"))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${trustLink} hover:border-st-fg`}
                >
                  <Icon as={MessageCircle} className="mt-0.5 shrink-0 text-st-accent" />
                  <span className="font-semibold">{t("trustAsk")}</span>
                </WaTap>
              </li>
            )}
          </ul>

          {(offer || store.freeDeliveryThreshold) && (
            <div className="grid gap-2" data-testid="product-offers">
              {offer && <OfferBanner offer={offer} locale={locale} labels={offerLabels(t)} />}
              {store.freeDeliveryThreshold ? (
                <p className="flex items-center gap-2 rounded-xl border border-st-border bg-st-surface px-3 py-2 text-sm font-semibold" data-testid="free-delivery-note">
                  <Icon as={Truck} className="shrink-0 text-st-accent" />
                  <span>{t("freeDeliveryOver", { amount: formatIQD(store.freeDeliveryThreshold, locale) })}</span>
                </p>
              ) : null}
            </div>
          )}

          <div className="grid gap-3">
            {specs.length > 0 && (
              <details className={section} open data-testid="section-details">
                <summary className={summary}>
                  {t("detailsTitle")} {chevron}
                </summary>
                <div className="px-4 pb-4">
                  <table className="w-full border-collapse text-sm" data-testid="specs-table">
                    <tbody>
                      {specs.map((r, i) => (
                        <tr key={i} className="border-t border-st-border first:border-t-0">
                          <th scope="row" className="w-2/5 py-2.5 pe-3 text-start align-top font-semibold text-st-muted">
                            {r.label}
                          </th>
                          <td className="py-2.5 align-top font-semibold">
                            <bdi>{r.value}</bdi>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            <details className={`${section} scroll-mt-24`} id="delivery-returns" data-testid="section-delivery">
              <summary className={summary}>
                {t("deliveryReturnsTitle")} {chevron}
              </summary>
              <div className="grid gap-3 px-4 pb-4">
                <DeliveryInfo
                  zones={settings.zones}
                  homeCity={store.city}
                  freeDeliveryThreshold={store.freeDeliveryThreshold}
                  hasReturnPolicy={false}
                  locale={locale}
                />
                <div>
                  <h3 className="mb-1 flex items-center gap-2 font-bold">
                    <Icon as={Undo2} className="text-st-accent" /> {t("returnPolicy")}
                  </h3>
                  {returnPolicy ? (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-st-muted">{returnPolicy}</p>
                  ) : (
                    <p className="text-sm text-st-muted">{t("noReturnPolicy")}</p>
                  )}
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>

      <ProductStrip
        id="more-h"
        title={t("moreFromStore")}
        products={related}
        slug={store.slug}
        locale={locale}
        labels={badges}
        from={t.raw("from") as string}
        testId="related"
      />
    </div>
  );
}

function DescriptionText({ paragraphs }: { paragraphs: string[][] }) {
  return paragraphs.map((lines, i) => (
    <p key={i}>
      {lines.map((l, j) => (
        <span key={j}>
          {j > 0 && <br />}
          {l}
        </span>
      ))}
    </p>
  ));
}
