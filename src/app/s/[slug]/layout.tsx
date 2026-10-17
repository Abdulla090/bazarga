import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { loadStore } from "./data";
import { CartDrawer } from "@/components/store/CartDrawer";
import { PreviewBridge } from "@/components/store/PreviewBridge";
import { SourceCapture } from "@/components/store/SourceCapture";
import { CookieNotice } from "@/components/store/CookieNotice";
import { SellerPixels } from "@/components/store/SellerPixels";
import { StoreHeader, StoreFooter } from "@/components/store/chrome";
import { resolveDesign } from "./design";
import { currentLocale } from "@/server/locale";
import { pickText } from "@/lib/i18n";
import { resolveTheme, themeStyle } from "@/lib/theme";
import { publishedThemeStyle, parseTheme } from "@/lib/theme-studio/resolve";
import { normalizePhone } from "@/lib/phone";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await loadStore(slug);
  const locale = await currentLocale();
  return {
    title: { absolute: store.name },
    description: pickText(store.tagline, locale) || store.name,
    openGraph: { title: store.name, images: store.logoUrl ? [store.logoUrl] : undefined },
  };
}

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await loadStore(slug);
  const t = await getTranslations("store");
  const locale = await currentLocale();
  const about = pickText(store.about, locale);
  const returns = pickText(store.returnPolicy, locale);
  const theme = resolveTheme(store.themePreset, store.accentColor);
  const hdr = parseTheme(store.themePublished)?.header;
  const wa = store.whatsapp ? normalizePhone(store.whatsapp) : null;
  const design = await resolveDesign(slug, store.themePublished);
  return (
    <div className="storefront flex min-h-dvh flex-col" data-theme={store.themePreset} data-design={design.id} data-header={hdr?.layout ?? "split"} style={{ ...themeStyle(theme), ...publishedThemeStyle(store.themePublished) }}>
      <PreviewBridge />
      <SourceCapture slug={store.slug} />
      <SellerPixels tiktokId={store.tiktokPixelId} metaId={store.metaPixelId} />
      <CookieNotice tiktokId={store.tiktokPixelId} metaId={store.metaPixelId} labels={{ title: t("cookie.title"), body: t("cookie.body"), accept: t("cookie.accept"), decline: t("cookie.decline") }} />
      <p id="announce-bar" hidden={!hdr?.announce} className="store-announce" data-testid="announce-bar">{hdr?.announce}</p>
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
