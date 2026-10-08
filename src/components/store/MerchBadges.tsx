import { percentOff } from "@/lib/merch";
import type { ProductBadge } from "@/lib/merch";
import { Flame, Icon } from "@/components/ui/icons";

export type MerchBadgeLabels = { bestSeller: string; new: string; featured: string };

/**
 * Photo-corner badges for a product (server-rendered, no client JS): "−17%" when on sale, then "Best seller"
 * (from real orders) or the seller's manual "New" / "Featured". At most two, so a 160 px card never fills up.
 */
export function MerchBadges({
  price,
  compareAtPrice,
  bestSeller,
  badge,
  labels,
  size = "sm",
  corner = "start",
}: {
  price: number;
  compareAtPrice: number | null;
  bestSeller: boolean;
  badge: ProductBadge | null;
  labels: MerchBadgeLabels;
  size?: "sm" | "md";
  /** "left": physical top-left — the product gallery keeps its photo counter (dir=ltr) at the top-right. */
  corner?: "start" | "left";
}) {
  const pct = percentOff(price, compareAtPrice);
  const second = bestSeller ? "best" : badge;
  if (pct === null && !second) return null;
  const text = size === "md" ? "text-xs sm:text-sm" : "text-[11px] leading-4";
  return (
    <span className={`pointer-events-none absolute flex ${corner === "left" ? "left-3 top-3 items-start" : "start-2 top-2"} max-w-[calc(100%-1rem)] flex-col items-start gap-1`}>
      {pct !== null && (
        <span className={`chip num bg-danger font-bold text-[#fff] ${text}`} data-testid="badge-sale">
          <bdi>−{pct}%</bdi>
        </span>
      )}
      {second === "best" && (
        <span className={`chip max-w-full gap-1 bg-ink font-bold text-paper ${text}`} data-testid="badge-best">
          <Icon as={Flame} className="shrink-0 text-gold" />
          <span className="truncate">{labels.bestSeller}</span>
        </span>
      )}
      {second === "new" && (
        <span className={`chip max-w-full bg-green font-bold text-white ${text}`} data-testid="badge-new">
          <span className="truncate">{labels.new}</span>
        </span>
      )}
      {second === "featured" && (
        <span className={`chip max-w-full bg-gold font-bold text-on-gold ${text}`} data-testid="badge-featured">
          <span className="truncate">{labels.featured}</span>
        </span>
      )}
    </span>
  );
}
