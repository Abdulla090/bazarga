import { percentOff } from "@/lib/merch";
import type { ProductBadge } from "@/lib/merch";

export type MerchBadgeLabels = { bestSeller: string; new: string; featured: string };

/**
 * The one photo badge for a product (server-rendered, no client JS). Priority: sold out (ink) → "−17%" sale (the
 * theme accent, blue by default — the only coloured badge) → "Best seller" (from real orders) → the seller's manual
 * "New" / "Featured" (white pill). Cards put it bottom-start; the product gallery keeps it top-left.
 */
export function MerchBadges({
  price,
  compareAtPrice,
  bestSeller,
  badge,
  labels,
  soldOut = false,
  soldOutLabel,
  size = "sm",
  corner = "start",
}: {
  price: number;
  compareAtPrice: number | null;
  bestSeller: boolean;
  badge: ProductBadge | null;
  labels: MerchBadgeLabels;
  soldOut?: boolean;
  soldOutLabel?: string;
  size?: "sm" | "md";
  /** "gallery": physical top-left of the product photo (past the LTR desktop thumbnail column); the counter (dir=ltr) sits top-right. */
  corner?: "start" | "gallery";
}) {
  const pct = percentOff(price, compareAtPrice);
  const kind = soldOut && soldOutLabel ? "out" : pct !== null ? "sale" : bestSeller ? "best" : badge;
  if (!kind) return null;
  const text = size === "md" ? "text-xs sm:text-[13px]" : "text-xs";
  const pill = `inline-flex min-h-6 max-w-full items-center rounded-full px-2.5 font-medium leading-none ${text}`;
  const quiet = `${pill} bg-st-surface text-st-fg shadow-e1`;
  return (
    <span className={`pointer-events-none absolute z-[1] flex ${corner === "gallery" ? "left-3 top-3 md:ltr:left-[calc(4.5rem+1.5rem)]" : "bottom-3 start-3"} max-w-[calc(100%-1.5rem)]`}>
      {kind === "out" && (
        <span className={`${pill} bg-st-fg text-st-bg`} data-testid="badge-soldout">
          <span className="truncate">{soldOutLabel}</span>
        </span>
      )}
      {kind === "sale" && (
        <span className={`${pill} num bg-st-accent text-st-on-accent`} data-testid="badge-sale">
          <bdi>−{pct}%</bdi>
        </span>
      )}
      {kind === "best" && (
        <span className={quiet} data-testid="badge-best">
          <span className="truncate">{labels.bestSeller}</span>
        </span>
      )}
      {kind === "new" && (
        <span className={quiet} data-testid="badge-new">
          <span className="truncate">{labels.new}</span>
        </span>
      )}
      {kind === "featured" && (
        <span className={quiet} data-testid="badge-featured">
          <span className="truncate">{labels.featured}</span>
        </span>
      )}
    </span>
  );
}
