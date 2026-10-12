import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { ThemeEditor } from "@/components/dashboard/ThemeEditor";
import { THEME_STUDIO_PRESETS, DEFAULT_THEME } from "@/lib/theme-studio/presets";
import { parseTheme } from "@/lib/theme-studio/resolve";
import { themeToCssVars } from "@/lib/theme-studio/css";

export const metadata = { title: "Theme" };

export default async function ThemePage() {
  const { store } = await requireStore();
  const t = await getTranslations("themeStudio");
  const published = parseTheme(store.themePublished);
  const draft = parseTheme(store.themeDraft) ?? published ?? DEFAULT_THEME!;
  const presets = Object.entries(THEME_STUDIO_PRESETS).map(([id, theme]) => ({ id, theme, vars: themeToCssVars(theme).vars }));
  return (
    <ThemeEditor
      slug={store.slug}
      presets={presets}
      initial={draft}
      published={published}
      labels={{
        title: t("title"), presets: t("presets"), publish: t("publish"), published: t("published"), unpublished: t("unpublished"),
        desktop: t("desktop"), phone: t("phone"), saving: t("saving"), saved: t("saved"), preview: t("preview"),
        names: Object.fromEntries(Object.keys(THEME_STUDIO_PRESETS).map((k) => [k, t(`preset.${k}`)])),
      }}
    />
  );
}
