import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { env } from "@/server/env";
import { updateStoreAction } from "@/server/actions/dashboard";
import { currentLocale } from "@/server/locale";
import { StoreForm } from "@/components/dashboard/StoreForm";
import { ShowcaseToggle } from "@/components/dashboard/ShowcaseToggle";
import { PixelsForm } from "@/components/dashboard/PixelsForm";
import { ThemeForm } from "@/components/dashboard/ThemeForm";
import { StorefrontForm } from "@/components/dashboard/StorefrontForm";
import { IRAQI_CITIES } from "@/lib/cities";
import { pickText } from "@/lib/i18n";
import { pushConfig } from "@/server/push";
import { LazyPushToggle } from "@/components/pwa/lazy";
import Link from "next/link";
import { gateway } from "@/server/payments/gateway/registry";

export default async function SettingsPage() {
  const { store } = await requireStore();
  const t = await getTranslations("settings");
  const locale = await currentLocale();
  const push = pushConfig();
  const tg = await getTranslations("gatewayPay");
  return (
    <div className="grid max-w-2xl gap-4">
      <h1 className="t-headline">{t("title")}</h1>
      {/* Hidden entirely when VAPID keys are not configured. */}
      {push && <LazyPushToggle vapidPublicKey={push.publicKey} />}
      <StoreForm
        action={updateStoreAction}
        mode="edit"
        rootDomain={new URL(env().APP_URL).host}
        cities={IRAQI_CITIES.map((c) => ({ key: c.key, name: pickText(c.name, locale) }))}
        initial={{
          name: store.name,
          slug: store.slug,
          defaultLocale: store.defaultLocale,
          phone: store.phone ? `+${store.phone}` : null,
          whatsapp: store.whatsapp ? `+${store.whatsapp}` : null,
          instagram: store.instagram,
          city: store.city,
          logoUrl: store.logoUrl,
          tagline: store.tagline as Record<string, string>,
        }}
      />
      <StorefrontForm
        maxMb={env().MAX_UPLOAD_MB}
        initial={{
          coverImageUrl: store.coverImageUrl,
          coverImagePlaceholder: store.coverImagePlaceholder,
          coverImageRenditions: store.coverImageRenditions ?? [],
          freeDeliveryThreshold: store.freeDeliveryThreshold,
        }}
      />
      <ShowcaseToggle optedIn={store.showcaseOptIn} />
      <PixelsForm initial={{ tiktokPixelId: store.tiktokPixelId, metaPixelId: store.metaPixelId }} />
      <Link href="/dashboard/payments" className="card flex min-h-11 items-center justify-between gap-3" data-testid="settings-payments-link">
        <span className="grid gap-0.5">
          <span className="font-bold">{tg("settingsTitle")}</span>
          <span className="hint">{gateway() ? tg("toggleLabel") : tg("comingSoon")}</span>
        </span>
        <span aria-hidden className="text-xl text-ink-70 rtl:rotate-180">›</span>
      </Link>
      <ThemeForm
        initial={{
          themePreset: store.themePreset,
          accentColor: store.accentColor,
          about: store.about,
          returnPolicy: store.returnPolicy,
        }}
      />
    </div>
  );
}
