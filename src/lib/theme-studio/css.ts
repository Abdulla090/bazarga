import { ensureContrast, mix, readableOn } from "./contrast";
import type { StoreTheme } from "./schema";

const RADIUS = { none: "0px", sm: "6px", md: "12px", lg: "20px" } as const;
const BTN = { square: "2px", rounded: "10px", pill: "999px" } as const;
const SCALE = { s: "0.94", m: "1", l: "1.08" } as const;

/** Derive every storefront CSS custom property from a validated theme. Pure; also reports auto-fixes. */
export function themeToCssVars(t: StoreTheme): { vars: Record<string, string>; fixes: string[] } {
  const fixes: string[] = [];
  const text = ensureContrast(t.colors.text, t.colors.bg);
  if (text.fixed) fixes.push("text");
  const accentText = ensureContrast(t.colors.accent, t.colors.bg, 3);
  if (accentText.fixed) fixes.push("accent");
  const dark = readableOn(t.colors.bg) === "#FFFFFF";
  const vars: Record<string, string> = {
    "--t-bg": t.colors.bg,
    "--t-surface": t.colors.surface,
    "--t-fg": text.color,
    "--t-muted": mix(text.color, t.colors.bg, 0.38),
    "--t-border": mix(t.colors.bg, text.color, dark ? 0.16 : 0.12),
    "--t-accent": t.colors.accent,
    "--t-accent-hover": mix(t.colors.accent, dark ? "#FFFFFF" : "#000000", 0.14),
    "--t-on-accent": readableOn(t.colors.accent),
    "--t-accent-soft": mix(t.colors.bg, t.colors.accent, 0.12),
    "--t-link": accentText.color,
    "--t-radius-card": RADIUS[t.cards.radius],
    "--t-radius-btn": BTN[t.buttons.shape],
    "--t-font-scale": SCALE[t.type.scale],
  };
  return { vars, fixes };
}
