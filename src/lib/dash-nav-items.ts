/** Dashboard destinations searchable from the Ctrl/Cmd-K palette (labels = dash.<key>). */
export const PALETTE_ITEMS = [
  { href: "/dashboard", key: "home" },
  { href: "/dashboard/orders", key: "orders" },
  { href: "/dashboard/products", key: "products" },
  { href: "/dashboard/analytics", key: "analytics" },
  { href: "/dashboard/categories", key: "categories" },
  { href: "/dashboard/discounts", key: "discounts" },
  { href: "/dashboard/delivery", key: "delivery" },
  { href: "/dashboard/payments", key: "payments" },
  { href: "/dashboard/customers", key: "customers" },
  { href: "/dashboard/ai", key: "ai" },
  { href: "/dashboard/theme", key: "theme" },
  { href: "/dashboard/share", key: "share" },
  { href: "/dashboard/settings", key: "settings" },
] as const;

export function filterPalette<T extends { label: string }>(items: T[], q: string): T[] {
  const n = q.trim().toLowerCase();
  return n ? items.filter((i) => i.label.toLowerCase().includes(n)) : items;
}

/** "g then <key>" go-to shortcuts (Linear style). */
export const GO_SHORTCUTS: Record<string, string> = {
  h: "/dashboard",
  o: "/dashboard/orders",
  p: "/dashboard/products",
  a: "/dashboard/analytics",
  c: "/dashboard/customers",
  d: "/dashboard/discounts",
  s: "/dashboard/settings",
  t: "/dashboard/theme",
};

export function goShortcutTarget(key: string): string | null {
  return GO_SHORTCUTS[key.toLowerCase()] ?? null;
}
