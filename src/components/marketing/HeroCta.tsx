import Link from "next/link";
import { ArrowForward } from "@/components/ui/icons";

/**
 * The hero "Start free" hook: solid #2563EB pill with a crisp 1.5px rotating gradient stroke, a sliding arrow and a
 * tiny 7x4 orders heatmap ("your store's sales start here") that fills in column by column, then the newest column
 * gently pulses. Pure CSS (globals.css .cta-hook), CSP-safe; the only inline styles are the per-cell --c index.
 * Hover/press go ink. No blur or glow anywhere: every edge is a hard edge.
 */
// Activity levels 0..4, column by column (oldest -> newest), trending up toward today.
const LEVELS = [
  [0, 1, 0, 1], [1, 0, 2, 1], [1, 2, 1, 2], [2, 1, 3, 2], [2, 3, 2, 3], [3, 4, 3, 3], [4, 3, 4, 4],
];

export function HeroCta({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} data-hero-cta className="cta-hook group">
      <span aria-hidden="true" className="cta-heat" data-heatmap>
        {LEVELS.flatMap((col, c) =>
          col.map((l, r) => (
            <i key={`${c}-${r}`} data-l={l} data-today={c === LEVELS.length - 1 ? "" : undefined} style={{ "--c": c, "--r": r } as React.CSSProperties} />
          )),
        )}
      </span>
      <span className="min-w-0 truncate">{label}</span>
      <ArrowForward className="cta-arrow shrink-0 text-lg" />
    </Link>
  );
}
