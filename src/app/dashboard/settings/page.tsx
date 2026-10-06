import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { env } from "@/server/env";
import { updateStoreAction } from "@/server/actions/dashboard";
import { currentLocale } from "@/server/locale";
import { StoreForm } from "@/components/dashboard/StoreForm";
import { IRAQI_CITIES } from "@/lib/cities";
import { pickText } from "@/lib/i18n";

export default async function SettingsPage() {
  const { store } = await requireStore();
  const t = await getTranslations("settings");
  const locale = await currentLocale();
  return (
    <div className="grid max-w-2xl gap-4">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
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
    </div>
  );
}
