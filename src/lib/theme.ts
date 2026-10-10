/**
 * Brand tokens and storefront theme presets.
 * Brand: Blue #2563EB · Ink #0A0A0B · Paper #FAFAF9.
 * A store picks a preset (`stores.theme_preset`) and may override the accent (`stores.accent_color`).
 * Presets only ever emit CSS custom properties — the storefront layout sets them on its wrapper, components read
 * them through Tailwind tokens (`bg-accent`, `text-on-accent`, `bg-surface`…), so no per-store CSS is generated.
 */
export const BRAND = {
  gold: "#2563EB",
  ink: "#0A0A0B",
  green: "#1F8A5B",
  paper: "#FAFAF9",
  /** Mountain Green darkened for white text: brand green on white is 4.33:1 (fails AA for body text), this is 5.33:1. */
  greenDeep: "#1A7A50",
} as const;

export const THEME_PRESETS = ["bazaar", "mountain", "night"] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];
export const DEFAULT_THEME_PRESET: ThemePreset = "bazaar";

export function isThemePreset(v: unknown): v is ThemePreset {
  return typeof v === "string" && (THEME_PRESETS as readonly string[]).includes(v);
}

export type ThemeTokens = {
  /** Page background. */
  bg: string;
  /** Cards / sheets. */
  surface: string;
  /** Primary text. */
  fg: string;
  /** Secondary text. */
  muted: string;
  border: string;
  /** Buttons, links, price highlights. */
  accent: string;
  /** Text on top of the accent. */
  onAccent: string;
  /** Header band behind the store name / cover. */
  hero: string;
  onHero: string;
  /** Corner radius for cards and buttons. */
  radius: string;
};

export const PRESET_TOKENS: Record<ThemePreset, ThemeTokens> = {
  /** Clean white + blue — the Bazarga house style. */
  bazaar: {
    bg: BRAND.paper,
    surface: "#FFFFFF",
    fg: BRAND.ink,
    muted: "#4B5563",
    border: "#E7E5E4",
    accent: "#2563EB",
    onAccent: "#FFFFFF",
    hero: BRAND.ink,
    onHero: BRAND.paper,
    radius: "1rem",
  },
  /** Fresh, natural — produce, honey, cosmetics. */
  mountain: {
    bg: "#F4F8F5",
    surface: "#FFFFFF",
    fg: "#0E2A1E",
    muted: "#3F5A4D",
    border: "#D5E5DB",
    accent: BRAND.greenDeep,
    onAccent: "#FFFFFF",
    hero: BRAND.greenDeep,
    onHero: "#FFFFFF",
    radius: "0.75rem",
  },
  /** Dark, premium — fashion, electronics, perfume. */
  night: {
    bg: BRAND.ink,
    surface: "#16181D",
    fg: BRAND.paper,
    muted: "#A8AFBD",
    border: "#2A2E37",
    accent: "#60A5FA",
    onAccent: BRAND.ink,
    hero: "#000000",
    onHero: BRAND.paper,
    radius: "0.5rem",
  },
};

export const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

/** WCAG relative luminance of a #RRGGBB colour. */
export function luminance(hex: string): number {
  if (!HEX_COLOR_RE.test(hex)) throw new Error(`Invalid colour: ${hex}`);
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Pick ink or white text for a seller-chosen accent, whichever reads better. */
export function readableOn(bgHex: string): string {
  return contrastRatio(bgHex, BRAND.ink) >= contrastRatio(bgHex, "#FFFFFF") ? BRAND.ink : "#FFFFFF";
}

/** Resolve a store's tokens: preset, then the seller's accent override (with an auto-contrasting text colour). */
export function resolveTheme(preset: string | null | undefined, accentColor?: string | null): ThemeTokens {
  const base = PRESET_TOKENS[isThemePreset(preset) ? preset : DEFAULT_THEME_PRESET];
  if (!accentColor || !HEX_COLOR_RE.test(accentColor)) return base;
  return { ...base, accent: accentColor, onAccent: readableOn(accentColor) };
}

/** CSS custom properties for a store wrapper's `style` prop. */
export function themeStyle(tokens: ThemeTokens): Record<`--${string}`, string> {
  return {
    "--st-bg": tokens.bg,
    "--st-surface": tokens.surface,
    "--st-fg": tokens.fg,
    "--st-muted": tokens.muted,
    "--st-border": tokens.border,
    "--st-accent": tokens.accent,
    "--st-on-accent": tokens.onAccent,
    "--st-hero": tokens.hero,
    "--st-on-hero": tokens.onHero,
    "--st-radius": tokens.radius,
  };
}
