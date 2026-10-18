import type { StoreTheme } from "./schema";

type P = Omit<StoreTheme, "v" | "preset" | "design"> & { design?: StoreTheme["design"] };
const base = (preset: string, p: P): StoreTheme => ({ v: 1, preset, design: "classic", ...p });

export const THEME_STUDIO_PRESETS: Record<string, StoreTheme> = {
  ivory: base("ivory", {
    colors: { accent: "#1F2937", bg: "#FAF8F4", surface: "#FFFFFF", text: "#16130F" },
    type: { pair: "sans-clean", scale: "m" },
    buttons: { shape: "pill", style: "solid", size: "m" },
    cards: { radius: "lg", style: "hairline", ratio: "portrait" },
    background: { kind: "solid" }, header: { layout: "centered" },
  }),
  midnight: base("midnight", {
    colors: { accent: "#7C9CFF", bg: "#0B0D12", surface: "#141821", text: "#F2F4F8" },
    type: { pair: "sans-clean", scale: "m" },
    buttons: { shape: "rounded", style: "solid", size: "m" },
    cards: { radius: "md", style: "hairline", ratio: "square" },
    background: { kind: "gradient" }, header: { layout: "split" },
  }),
  gallery: base("gallery", {
    design: "gallery",
    colors: { accent: "#111111", bg: "#FFFFFF", surface: "#F5F5F4", text: "#111111" },
    type: { pair: "serif-editorial", scale: "l" },
    buttons: { shape: "square", style: "outline", size: "l" },
    cards: { radius: "none", style: "flat", ratio: "portrait" },
    background: { kind: "solid" }, header: { layout: "minimal" },
  }),
  boutique: base("boutique", {
    design: "boutique",
    colors: { accent: "#9D4A5E", bg: "#FBF6F3", surface: "#FFFFFF", text: "#2A1C20" },
    type: { pair: "rounded-soft", scale: "m" },
    buttons: { shape: "pill", style: "solid", size: "m" },
    cards: { radius: "lg", style: "flat", ratio: "portrait" },
    background: { kind: "solid" }, header: { layout: "centered" },
  }),
  studio: base("studio", {
    design: "studio",
    colors: { accent: "#2563EB", bg: "#F6F8FC", surface: "#FFFFFF", text: "#0B1220" },
    type: { pair: "sans-clean", scale: "m" },
    buttons: { shape: "rounded", style: "solid", size: "m" },
    cards: { radius: "md", style: "shadow", ratio: "square" },
    background: { kind: "gradient" }, header: { layout: "split" },
  }),
  stone: base("stone", {
    colors: { accent: "#57534E", bg: "#F3F1ED", surface: "#FBFAF8", text: "#1C1917" },
    type: { pair: "rounded-soft", scale: "m" },
    buttons: { shape: "rounded", style: "soft", size: "m" },
    cards: { radius: "lg", style: "flat", ratio: "square" },
    background: { kind: "pattern" }, header: { layout: "centered" },
  }),
  mono: base("mono", {
    design: "mono",
    colors: { accent: "#000000", bg: "#FFFFFF", surface: "#FFFFFF", text: "#000000" },
    type: { pair: "mono-bold", scale: "l" },
    buttons: { shape: "square", style: "solid", size: "l" },
    cards: { radius: "none", style: "hairline", ratio: "square" },
    background: { kind: "solid" }, header: { layout: "minimal" },
  }),
  editorial: base("editorial", {
    design: "editorial",
    colors: { accent: "#7A1F2B", bg: "#F7F2EA", surface: "#FFFFFF", text: "#16110E" },
    type: { pair: "serif-editorial", scale: "l" },
    buttons: { shape: "square", style: "solid", size: "m" },
    cards: { radius: "none", style: "flat", ratio: "portrait" },
    background: { kind: "solid" }, header: { layout: "centered" },
  }),
  market: base("market", {
    design: "market",
    colors: { accent: "#B42318", bg: "#F3F4F6", surface: "#FFFFFF", text: "#111827" },
    type: { pair: "sans-clean", scale: "s" },
    buttons: { shape: "rounded", style: "solid", size: "s" },
    cards: { radius: "sm", style: "hairline", ratio: "square" },
    background: { kind: "solid" }, header: { layout: "split" },
  }),
  fresh: base("fresh", {
    colors: { accent: "#0F766E", bg: "#F4FBF8", surface: "#FFFFFF", text: "#0B2220" },
    type: { pair: "rounded-soft", scale: "m" },
    buttons: { shape: "pill", style: "soft", size: "m" },
    cards: { radius: "lg", style: "shadow", ratio: "landscape" },
    background: { kind: "gradient" }, header: { layout: "split" },
  }),
  // Premium (Max): full designs, not palette swaps (src/lib/theme-studio/designs.ts PREMIUM_DESIGNS).
  atelier: base("atelier", {
    design: "atelier",
    colors: { accent: "#B08D57", bg: "#16120F", surface: "#201A16", text: "#F3EDE4" },
    type: { pair: "serif-editorial", scale: "l" },
    buttons: { shape: "square", style: "outline", size: "l" },
    cards: { radius: "none", style: "hairline", ratio: "portrait" },
    background: { kind: "solid" }, header: { layout: "centered" },
  }),
  pulse: base("pulse", {
    design: "pulse",
    colors: { accent: "#C6F432", bg: "#0A0B0F", surface: "#15171E", text: "#F5F7FA" },
    type: { pair: "mono-bold", scale: "m" },
    buttons: { shape: "pill", style: "solid", size: "m" },
    cards: { radius: "lg", style: "shadow", ratio: "square" },
    background: { kind: "pattern" }, header: { layout: "split" },
  }),
};

/** Presets whose design is premium (Max). */
export const PREMIUM_PRESETS: ReadonlySet<string> = new Set(["atelier", "pulse"]);

/** The editor's starting point keeps the classic composition; "studio" is an opt-in design. */
export const DEFAULT_THEME: StoreTheme = { ...THEME_STUDIO_PRESETS.studio!, design: "classic" };
