import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { loadStore } from "./data";
import { CartDrawerLazy as CartDrawer } from "@/components/store/CartDrawerLazy";
import { PreviewBridge } from "@/components/store/PreviewBridge";
import { SourceCapture } from "@/components/store/SourceCapture";
import { CookieNotice } from "@/components/store/CookieNotice";
import { SellerPixels } from "@/components/store/SellerPixels";
import { HeaderTicker, StoreHeader, StoreFooter } from "@/components/store/chrome";
import { resolveStoreDesign } from "./design";
import { currentLocale } from "@/server/locale";
import { pickText } from "@/lib/i18n";
import { resolveTheme, themeStyle } from "@/lib/theme";
import { publishedThemeStyle, parseTheme } from "@/lib/theme-studio/resolve";
import { normalizePhone } from "@/lib/phone";
import { normalizePlan } from "@/lib/plans";
import { effectiveSeo, whiteLabelOn } from "@/lib/seo";
import { StatusPage } from "@/components/site/StatusPage";
import { maintenanceFor } from "@/server/admin/site-gate";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await loadStore(slug);
  const locale = await currentLocale();
  const plan = normalizePlan(store.plan);
  const seo = effectiveSeo(plan, store.seo);
  const title = seo.title || store.name;
  const description = seo.description || pickText(store.tagline, locale) || store.name;
  const ogImage = seo.ogImageUrl || store.coverImageUrl || store.logoUrl;
  const white = whiteLabelOn(plan, store.whiteLabel);
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, siteName: store.name, images: ogImage ? [ogImage] : undefined },
    twitter: { card: ogImage ? "summary_large_image" : "summary", title, description, images: ogImage ? [ogImage] : undefined },
    // White-label (Max): the store's own name and logo replace every Reelcart mark in the browser chrome.
    ...(white
      ? {
          applicationName: store.name,
          appleWebApp: { capable: true, title: store.name, statusBarStyle: "default" as const },
          ...(store.logoUrl ? { icons: { icon: store.logoUrl, apple: store.logoUrl } } : {}),
        }
      : {}),
  };
}

// Browser chrome (Android address bar, iOS status bar) takes the store's own accent.
export async function generateViewport({ params }: { params: Promise<{ slug: string }> }): Promise<Viewport> {
  const { slug } = await params;
  const store = await loadStore(slug);
  const theme = resolveTheme(store.themePreset, store.accentColor);
  return { themeColor: theme.accent };
}

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await loadStore(slug);
  // Admin controls (docs/ADMIN.md): platform maintenance mode, then a suspended store, replace the whole storefront.
  const maint = await maintenanceFor();
  if (maint || store.suspendedAt) {
    const ts = await getTranslations("site");
    return maint
      ? <StatusPage title={ts("maintenance.title")} body={maint.message || ts("maintenance.body")} testId="maintenance-page" />
      : <StatusPage title={ts("suspended.title")} body={ts("suspended.body")} testId="store-suspended-page" />;
  }
  const t = await getTranslations("store");
  // Theme Studio preview bridge only matters inside the editor iframe; skip its JS for real shoppers.
  const inIframe = (await headers()).get("sec-fetch-dest") === "iframe";
  const locale = await currentLocale();
  const about = pickText(store.about, locale);
  const returns = pickText(store.returnPolicy, locale);
  const theme = resolveTheme(store.themePreset, store.accentColor);
  const { spec: design, previewTheme } = await resolveStoreDesign(slug, store.themePublished, store.plan);
  const active = previewTheme ?? parseTheme(store.themePublished);
  const hdr = active?.header;
  const wa = store.whatsapp ? normalizePhone(store.whatsapp) : null;
  // Design system v2: every axis of the composition is a data attribute; globals.css "Design system v2" styles them.
  return (
    <div
      className="storefront flex min-h-dvh flex-col"
      data-theme={store.themePreset}
      data-design={design.id}
      data-header={design.header}
      data-type={design.type}
      data-density={design.density}
      data-surface={design.surface}
      data-motion={design.motion}
      data-card={design.card}
      data-product={design.product}
      data-radius={active?.cards.radius ?? "md"}
      style={{ ...themeStyle(theme), ...publishedThemeStyle(previewTheme ?? store.themePublished) }}
    >
      {inIframe ? <PreviewBridge /> : null}
      <SourceCapture slug={store.slug} />
      {(store.tiktokPixelId || store.metaPixelId) && (
        <>
      <SellerPixels tiktokId={store.tiktokPixelId} metaId={store.metaPixelId} />
      <CookieNotice tiktokId={store.tiktokPixelId} metaId={store.metaPixelId} labels={{ title: t("cookie.title"), body: t("cookie.body"), accept: t("cookie.accept"), decline: t("cookie.decline") }} />
        </>
      )}
      <p id="announce-bar" hidden={!hdr?.announce} className="store-announce" data-testid="announce-bar">{hdr?.announce}</p>
      {design.header === "ticker" && <HeaderTicker text={hdr?.announce || pickText(store.tagline, locale) || store.name} />}
      <StoreHeader store={store} design={design} />
      {/* min-height keeps the footer below the fold while a page streams in or the cart reads localStorage, so it
          never jumps up into view (desktop CLS 0.06-0.11 on cart / search / offers before). */}
      <main className="store-page min-h-svh flex-1 pt-6 sm:pt-10">{children}</main>
      <CartDrawer
        slug={store.slug}
        labels={{ added: t("addedToCart"), viewCart: t("viewCart"), checkout: t("checkout"), continue: t("continue"), close: t("closeViewer"), inCart: t.raw("inCart") as string }}
      />
      <StoreFooter store={store} design={design} locale={locale} about={about} returns={returns} wa={wa} />
    </div>
  );
}
