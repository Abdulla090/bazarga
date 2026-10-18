import { themeSchema, type StoreTheme } from "./schema";

/**
 * Preview token for a whole theme (AI Website Designer option thumbnails): /s/<slug>?pv=1&pvt=t.<token> renders that
 * theme's colours, type and full composition for the preview load only, exactly like a flagship id does. The token is
 * base64url JSON of the theme *without* any text (no announcement line, no AI tagline): it can only pick a presentation
 * of the store's public data, never put words on it. Decoding re-validates with the theme schema.
 */
export const PREVIEW_TOKEN_PREFIX = "t.";
export const PREVIEW_TOKEN_RE = /^t\.[A-Za-z0-9_-]{16,2048}$/;

const toB64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));

/** Strip every free-text field: what is left is ids, enums and colours (ASCII only). */
export function slimPreviewTheme(t: StoreTheme): StoreTheme {
  const { copy: _copy, header, ...rest } = t;
  void _copy;
  return { ...rest, preset: "ai", header: { layout: header.layout } };
}

export function encodePreviewTheme(t: StoreTheme): string {
  return PREVIEW_TOKEN_PREFIX + toB64url(JSON.stringify(slimPreviewTheme(t)));
}

/** A token → a valid, text-free theme, or null for anything malformed. */
export function decodePreviewTheme(token: string | null | undefined): StoreTheme | null {
  if (!token || !PREVIEW_TOKEN_RE.test(token)) return null;
  try {
    const parsed = themeSchema.safeParse(JSON.parse(fromB64url(token.slice(PREVIEW_TOKEN_PREFIX.length))));
    return parsed.success ? slimPreviewTheme(parsed.data) : null;
  } catch {
    return null;
  }
}
