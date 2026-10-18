import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { ThemeEditor } from "@/components/dashboard/ThemeEditor";
import { THEME_STUDIO_PRESETS, DEFAULT_THEME, PREMIUM_PRESETS } from "@/lib/theme-studio/presets";
import { FLAGSHIP_LIST, THEME_GROUPS } from "@/lib/theme-studio/themes";
import { CARD_VARIANTS, DENSITIES, FOOTER_VARIANTS, GRID_VARIANTS, HEADER_VARIANTS, HERO_VARIANTS, HOME_SECTIONS, MOTIONS, PRODUCT_LAYOUTS, SURFACES, TYPE_PAIRS } from "@/lib/theme-studio/designs";
import { hasFeature, normalizePlan } from "@/lib/plans";
import { parseTheme } from "@/lib/theme-studio/resolve";
import { themeToCssVars } from "@/lib/theme-studio/css";
import { aiUi } from "@/server/ai/access";
import { getAiUsage } from "@/server/services/ai-quota";
import { db } from "@/server/db";

export const metadata = { title: "Theme" };

const OPTS = ["none", "sm", "md", "lg", "flat", "hairline", "shadow", "square", "portrait", "landscape", "solid", "gradient", "pattern", "centered", "split", "minimal"];

export default async function ThemePage() {
  const { store, user, role } = await requireStore();
  const t = await getTranslations("themeStudio");
  const ta = await getTranslations("aiDesigner");
  const te = await getTranslations("errors");
  // AI Website Designer (SF10): owner only; Max uses it, lower plans see the upgrade note, no AI key → operator note/hidden.
  const ui = role === "owner" ? aiUi(user.email) : "hidden";
  const aiMode = ui === "on" && !hasFeature(normalizePlan(store.plan), "aiDesigner") ? "locked" : ui;
  const aiLeft = aiMode === "on" ? (await getAiUsage(db(), store.id, "aiDesigner")).remaining : 0;
  const vibes = ["minimal", "bold", "luxury", "playful", "natural", "classic"] as const;
  const errKeys = ["generic", "hint_required", "ai_disabled", "plan_limit_ai", "ai_failed", "plan_feature", "owner_only", "RATE_LIMITED", "UNAVAILABLE", "FORBIDDEN"] as const;
  const published = parseTheme(store.themePublished);
  const draft = parseTheme(store.themeDraft) ?? published ?? DEFAULT_THEME!;
  const flagships = FLAGSHIP_LIST.map((f) => ({ id: f.id, group: f.group, premium: f.premium, theme: f.theme }));
  const vopts = [...new Set<string>([...HEADER_VARIANTS, ...HERO_VARIANTS, ...GRID_VARIANTS, ...CARD_VARIANTS, ...PRODUCT_LAYOUTS, ...FOOTER_VARIANTS, ...DENSITIES, ...SURFACES, ...MOTIONS, ...TYPE_PAIRS, ...HOME_SECTIONS])];
  const axes = ["header", "hero", "grid", "card", "product", "footer", "density", "surface", "motion", "pair", "sections"] as const;
  const presets = Object.entries(THEME_STUDIO_PRESETS).map(([id, theme]) => ({ id, theme, vars: themeToCssVars(theme).vars, premium: PREMIUM_PRESETS.has(id) }));
  return (
    <ThemeEditor
      slug={store.slug}
      presets={presets}
      flagships={flagships}
      initial={draft}
      published={published}
      premiumLocked={!hasFeature(normalizePlan(store.plan), "templatesPremium")}
      ai={{
        mode: aiMode,
        remaining: aiLeft,
        labels: {
          title: ta("title"), intro: ta("intro"), brief: ta("brief"), briefPh: ta("briefPh"), vibe: ta("vibe"),
          vibes: Object.fromEntries(vibes.map((v) => [v, ta(`vibes.${v}`)])), generate: ta("generate"), generating: ta("generating"),
          again: ta("again"), left: ta.raw("left") as string, ready: ta("ready"), discard: ta("discard"), lockedNote: ta("lockedNote"),
          upgrade: ta("upgrade"), connect: ta("connect"), maxBadge: ta("maxBadge"),
          errors: Object.fromEntries(errKeys.map((k) => [k, te.has(k) ? te(k) : te("generic")])),
        },
      }}
      labels={{
        title: t("title"), presets: t("presets"), publish: t("publish"), published: t("published"), unpublished: t("unpublished"),
        desktop: t("desktop"), phone: t("phone"), saving: t("saving"), undo: t("undo"), redo: t("redo"), surprise: t("surprise"), saved: t("saved"), preview: t("preview"),
        colors: t("colors"), buttons: t("buttons"), cards: t("cards"), header: t("header"), headerLayout: t("headerLayout"), announce: t("announce"), announcePh: t("announcePh"), cardsRadius: t("cardsRadius"), cardsStyle: t("cardsStyle"), cardsRatio: t("cardsRatio"), bgKind: t("bgKind"), opt: Object.fromEntries(OPTS.map((k) => [k, t(`opt.${k}`)])), shape: t("shape"), btnStyle: t("btnStyle"), shapes: { square: t("shapes.square"), rounded: t("shapes.rounded"), pill: t("shapes.pill") }, styles: { solid: t("styles.solid"), outline: t("styles.outline"), soft: t("styles.soft") }, type: t("type"), accent: t("accent"), bg: t("bg"), surface: t("surface"), text: t("text"), custom: t("custom"), lowContrast: t("lowContrast"), sizeLabel: t("sizeLabel"), sizes: { s: t("size.s"), m: t("size.m"), l: t("size.l") },
        premiumBadge: t("premiumBadge"), premiumNote: t("premiumNote"), premiumCta: t("premiumCta"),
        names: Object.fromEntries(Object.keys(THEME_STUDIO_PRESETS).map((k) => [k, t(`preset.${k}`)])),
        v2: {
          themesTab: t("themesTab"), layoutTab: t("layoutTab"), themesIntro: t("themesIntro"), layoutIntro: t("layoutIntro"), apply: t("apply"), inUse: t("inUse"),
          morePalettes: t("morePalettes"), moveUp: t("moveUp"), moveDown: t("moveDown"), showSection: t("showSection"), hideSection: t("hideSection"),
          group: Object.fromEntries(THEME_GROUPS.map((g) => [g, t(`group.${g}`)])),
          axis: Object.fromEntries(axes.map((a) => [a, t(`axis.${a}`)])),
          vopt: Object.fromEntries(vopts.map((o) => [o, t(`vopt.${o}`)])),
          flagship: Object.fromEntries(flagships.map((f) => [f.id, { name: t(`flagship.${f.id}.name`), desc: t(`flagship.${f.id}.desc`) }])),
        },
      }}
    />
  );
}
