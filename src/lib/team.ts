/** Only an invite link may be a post-login destination (no open redirects). */
export function safeInviteNext(v: unknown): string | null {
  return typeof v === "string" && /^\/invite\/[A-Za-z0-9_-]{20,100}$/.test(v) ? v : null;
}

/** Dashboard areas only the store owner can open; staff run orders, products, categories, customers, discounts, analytics, share. */
export const OWNER_ONLY_PATHS = ["/dashboard/settings", "/dashboard/payments", "/dashboard/delivery", "/dashboard/theme", "/dashboard/upgrade", "/dashboard/team"] as const;

export function isOwnerOnlyPath(path: string): boolean {
  return OWNER_ONLY_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}
