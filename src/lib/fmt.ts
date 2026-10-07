/**
 * Tiny `{name}` interpolation for strings translated on the server and passed to storefront client components
 * as props (storefronts ship no i18n runtime). Use `t.raw(key)` on the server to keep the placeholders.
 */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Pick the raw (uninterpolated) strings for `keys` from a server translator, typed by key. */
export function pickLabels<K extends string>(raw: (key: K) => unknown, keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(keys.map((k) => [k, String(raw(k))])) as Record<K, string>;
}
