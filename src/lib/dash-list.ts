import { normalizeSearchText } from "./catalog-filter";

/**
 * Dashboard list paging + search (E2E audit A3): orders and products used to render everything (products) or a hard
 * 200 newest (orders: order 201+ was unreachable). Pure helpers shared by the pages and tests.
 */
export const DASH_PAGE_SIZE = 50;

export function parseDashPage(v: string | string[] | undefined): number {
  const n = Number.parseInt(Array.isArray(v) ? v[0] ?? "" : v ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 10_000) : 1;
}

export function parseDashQuery(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] ?? "" : v ?? "").trim().slice(0, 64);
}

/** How a seller's order search is read: "#1042" / "1042" → order number; ≥4 digits → phone fragment; else name. */
export function orderQuery(q: string): { number: number | null; phoneDigits: string | null; text: string | null } {
  const s = q.trim();
  if (!s) return { number: null, phoneDigits: null, text: null };
  const latin = s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  const digits = latin.replace(/\D/g, "");
  const onlyNumber = /^#?\s*\d+$/.test(latin);
  // A phone typed the local way (0750…) is stored as +964750…: drop the leading 0.
  const phone = digits.length >= 4 ? digits.replace(/^0/, "") : null;
  return { number: onlyNumber && digits.length <= 9 ? Number(digits) : null, phoneDigits: /^[\d\s+()#-]+$/.test(latin) ? phone : null, text: onlyNumber ? null : s };
}

export function pageWindow(page: number, total: number, size = DASH_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(page, pages);
  return { page: p, pages, from: total === 0 ? 0 : (p - 1) * size + 1, to: Math.min(total, p * size), offset: (p - 1) * size };
}

export function matchesProduct(p: { name: Record<string, string | undefined | null>; sku?: string | null }, q: string): boolean {
  const terms = normalizeSearchText(q).split(" ").filter(Boolean);
  if (!terms.length) return true;
  const hay = normalizeSearchText([...Object.values(p.name), p.sku ?? ""].filter(Boolean).join(" "));
  return terms.every((t) => hay.includes(t));
}

export function listHref(base: string, p: { q?: string; status?: string; page?: number }) {
  const sp = new URLSearchParams();
  if (p.status) sp.set("status", p.status);
  if (p.q) sp.set("q", p.q);
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}
