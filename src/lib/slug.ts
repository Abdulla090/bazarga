export const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "www", "dashboard", "login", "signup", "logout", "s", "store", "stores", "help",
  "support", "mymarket", "static", "assets", "images", "files", "mail", "blog", "docs", "status",
]);

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/** Latin-only slug from any name. Kurdish/Arabic names yield "" — the UI then asks the seller to type one. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !RESERVED_SLUGS.has(slug);
}
