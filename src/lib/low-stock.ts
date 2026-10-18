import type { LocalizedText } from "./i18n";

/** At or below this many units a tracked product counts as "running low" (matches the storefront "only N left" cue). */
export const LOW_STOCK_THRESHOLD = 5;

export type StockLevel = "untracked" | "out" | "low" | "ok";

/** Stock level of a unit count; null means the seller does not track stock. */
export function stockLevel(stock: number | null | undefined): StockLevel {
  if (stock === null || stock === undefined) return "untracked";
  if (stock <= 0) return "out";
  if (stock <= LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}

export type LowStockRow = {
  productId: string;
  name: LocalizedText;
  /** Option value labels (e.g. Red, M) when the low stock is on a variant, else empty. */
  variantLabels: LocalizedText[];
  stock: number;
};

/** Sold-out first, then the fewest units left; ties keep the input order. Capped for a dashboard card. */
export function rankLowStock(rows: LowStockRow[], limit = 6): LowStockRow[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r.stock - b.r.stock || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.r);
}
