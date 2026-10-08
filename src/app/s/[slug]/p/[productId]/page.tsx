import Link from "next/link";
import { ViewPixel } from "@/components/store/ViewPixel";
import { cookies, headers } from "next/headers";
import { pickDeliveryZone, shopperCityCookie } from "@/lib/shopper-city";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { loadStore } from "../../data";
import { getCatalog, getProductDetail, getStorefrontSettings } from "@/server/cache/storefront";
import { currentLocale } from "@/server/locale";
import { env } from "@/server/env";
import { NONCE_HEADER } from "@/server/csp";
import { pickText, type Locale } from "@/lib/i18n";
import { formatIQD } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import { waLink } from "@/lib/whatsapp";
import {
  absoluteUrl,
  descriptionParagraphs,
  percentOff,
  productJsonLd,
  relatedProducts,
  serializeJsonLd,
  specRows,
} from "@/lib/product-page";
import { ProductGallery } from "@/components/store/ProductGallery";
import { ProductBuy, type BuyLabels } from "@/components/store/ProductBuy";
import { DeliveryInfo, etaText } from "@/components/store/DeliveryInfo";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import type { CatalogProduct } from "@/server/services/storefront";
import { ArrowBack, Banknote, Icon, MessageCircle, Truck, Undo2 } from "@/components/ui/icons";

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
  const [settings, catalog, t, tc, locale, nonce] = await Promise.all([
    getStorefrontSettings(store.id),
    getCatalog(store.id),
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
  };
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
      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <div className="min-w-0 md:sticky md:top-24 md:h-fit">
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
        </div>
        <div className="grid h-fit min-w-0 gap-5">
          <Link href={`/s/${store.slug}`} className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-st-muted">
            <ArrowBack /> {tc("back")}
          </Link>
          <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{name}</h1>
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
                <a
                  href={waLink(wa, [t("waIntro", { store: store.name }), name, shareUrl].join("\n"))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${trustLink} hover:border-st-fg`}
                >
                  <Icon as={MessageCircle} className="mt-0.5 shrink-0 text-st-accent" />
                  <span className="font-semibold">{t("trustAsk")}</span>
                </a>
              </li>
            )}
          </ul>

          <div className="grid gap-3">
            {paragraphs.length > 0 && (
              <details className={section} open data-testid="section-description">
                <summary className={summary}>
                  {t("descriptionTitle")} {chevron}
                </summary>
                <div className="grid gap-3 px-4 pb-4 leading-relaxed text-st-muted">
                  {paragraphs.map((lines, i) => (
                    <p key={i}>
                      {lines.map((l, j) => (
                        <span key={j}>
                          {j > 0 && <br />}
                          {l}
                        </span>
                      ))}
                    </p>
                  ))}
                </div>
              </details>
            )}

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

      {related.length > 0 && (
        <section aria-labelledby="more-h" className="grid gap-3" data-testid="related">
          <h2 id="more-h" className="text-lg font-extrabold">
            {t("moreFromStore")}
          </h2>
          <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {related.map((r) => (
              <li key={r.id} className="w-36 shrink-0 snap-start sm:w-44">
                <RelatedCard p={r} slug={store.slug} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Compact, server-only card for the "More from this store" strip (no add-to-cart island → no extra client JS). */
function RelatedCard({ p, slug, locale }: { p: CatalogProduct; slug: string; locale: Locale }) {
  const name = pickText(p.name, locale);
  const pct = percentOff(p.price, p.compareAtPrice);
  return (
    <Link href={`/s/${slug}/p/${p.id}`} className="block overflow-hidden rounded-[var(--radius-card)] border border-st-border bg-st-surface">
      <span className="relative block">
        {p.image ? (
          <ResponsiveImage image={p.image} alt="" sizes="176px" index={9} className="aspect-square w-full object-cover" />
        ) : (
          <span className="block aspect-square w-full bg-st-bg" />
        )}
        {pct !== null && <span className="chip num absolute start-2 top-2 bg-danger text-[#fff]">−{pct}%</span>}
      </span>
      <span className="grid gap-1 p-2.5">
        <span className="line-clamp-2 min-h-10 text-sm font-bold leading-snug">{name}</span>
        <span className="num text-sm font-extrabold">{formatIQD(p.price, locale)}</span>
      </span>
    </Link>
  );
}
