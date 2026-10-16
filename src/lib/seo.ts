/** Public site URL for absolute links (sitemap, robots, OG). APP_URL without a trailing slash; localhost in dev. */
export function siteUrl(appUrl: string | undefined = process.env.APP_URL): string {
  try {
    const u = new URL(appUrl || "http://localhost:3000");
    return u.origin;
  } catch {
    return "http://localhost:3000";
  }
}

/** Marketing + legal pages that belong in the sitemap. */
export const STATIC_PUBLIC_PATHS = ["/", "/pricing", "/showcase", "/terms", "/privacy", "/refund"] as const;

/** Never indexed: private, transactional or per-shopper pages. Mirrored in robots.txt and page-level noindex. */
export const ROBOTS_DISALLOW = ["/dashboard", "/admin", "/api/", "/onboarding", "/payments/", "/e404", "/s/*/cart", "/s/*/order/", "/s/*/track"] as const;
