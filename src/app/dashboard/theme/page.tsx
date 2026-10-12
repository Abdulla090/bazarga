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
        colors: t("colors"), buttons: t("buttons"), shape: t("shape"), btnStyle: t("btnStyle"), shapes: { square: t("shapes.square"), rounded: t("shapes.rounded"), pill: t("shapes.pill") }, styles: { solid: t("styles.solid"), outline: t("styles.outline"), soft: t("styles.soft") }, type: t("type"), accent: t("accent"), bg: t("bg"), surface: t("surface"), text: t("text"), custom: t("custom"), lowContrast: t("lowContrast"), sizeLabel: t("sizeLabel"), sizes: { s: t("size.s"), m: t("size.m"), l: t("size.l") },
        names: Object.fromEntries(Object.keys(THEME_STUDIO_PRESETS).map((k) => [k, t(`preset.${k}`)])),
      }}
    />
  );
}
