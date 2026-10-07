import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { loadStore } from "../../data";
import { getProductDetail, getStorefrontSettings } from "@/server/cache/storefront";
import { currentLocale } from "@/server/locale";
import { env } from "@/server/env";
import { pickText } from "@/lib/i18n";
import { ProductGallery } from "@/components/store/ProductGallery";
import { ProductBuy, type BuyLabels } from "@/components/store/ProductBuy";
import { DeliveryInfo } from "@/components/store/DeliveryInfo";
import { ArrowBack } from "@/components/ui/icons";

async function load(slug: string, productId: string) {
  if (!z.uuid().safeParse(productId).success) notFound();
  const store = await loadStore(slug);
  const p = await getProductDetail(store.id, productId);
  if (!p) notFound();
  return { store, p };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; productId: string }> }): Promise<Metadata> {
  const { slug, productId } = await params;
  const { store, p } = await load(slug, productId);
  const locale = await currentLocale();
  return {
    title: { absolute: `${pickText(p.name, locale)} · ${store.name}` },
    description: pickText(p.description, locale).slice(0, 160),
    openGraph: { images: p.images[0] ? [p.images[0].url] : undefined },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string; productId: string }> }) {
  const { slug, productId } = await params;
  const { store, p } = await load(slug, productId);
  const [settings, t, tc, locale] = await Promise.all([
    getStorefrontSettings(store.id),
    getTranslations("store"),
    getTranslations("common"),
    currentLocale(),
  ]);
  const name = pickText(p.name, locale);
  const description = pickText(p.description, locale);
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
  };
  const shareUrl = `${env().APP_URL.replace(/\/$/, "")}/s/${store.slug}/p/${p.id}`;

  return (
    // Bottom padding on phones so the sticky buy bar never covers the footer.
    <div className="grid gap-6 pb-20 md:grid-cols-2 md:gap-10 md:pb-0">
      <div className="min-w-0 md:sticky md:top-24 md:h-fit">
        <ProductGallery images={p.images} alt={name} label={{ photo: t("photo"), of: t("of") }} />
      </div>
      <div className="grid h-fit min-w-0 gap-5">
        <Link href={`/s/${store.slug}`} className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-ink-70">
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
        {description && <p className="whitespace-pre-line leading-relaxed text-ink-70">{description}</p>}
        <DeliveryInfo
          zones={settings.zones}
          homeCity={store.city}
          freeDeliveryThreshold={store.freeDeliveryThreshold}
          hasReturnPolicy={!!pickText(store.returnPolicy, locale)}
          locale={locale}
        />
      </div>
    </div>
  );
}
