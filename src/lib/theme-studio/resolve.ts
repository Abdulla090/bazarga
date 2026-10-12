import { themeToCssVars } from "./css";
import { themeSchema, type StoreTheme } from "./schema";

/** Parse stored theme JSON; null when absent or invalid (caller falls back to the legacy preset). */
export function parseTheme(raw: unknown): StoreTheme | null {
  if (raw == null) return null;
  const r = themeSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Inline style object of --t-* vars for a stored theme, or undefined when the store has no published theme. */
export function publishedThemeStyle(raw: unknown): Record<string, string> | undefined {
  const t = parseTheme(raw);
  if (!t) return undefined;
  const v = themeToCssVars(t).vars as Record<string, string>;
  // Bridge to the --st-* tokens the storefront components already read, so a published theme restyles everything.
  return {
    ...v,
    "--st-bg": v["--t-bg"]!,
    "--st-surface": v["--t-surface"]!,
    "--st-fg": v["--t-fg"]!,
    "--st-muted": v["--t-muted"]!,
    "--st-border": v["--t-border"]!,
    "--st-accent": v["--t-accent"]!,
    "--st-on-accent": v["--t-on-accent"]!,
    "--st-radius": v["--t-radius-card"]!,
  };
}
