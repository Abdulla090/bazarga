"use client";
import { useEffect, useRef } from "react";

/**
 * Pointer spotlight for the Why bento. One delegated pointermove on the grid writes --mx/--my (px, tile-local) on the
 * tile under the cursor, rAF-throttled; CSS (.bento-tile::before/::after) draws a crisp 1px gradient ring + a faint
 * inner wash at that point. Fine pointers only; renders nothing itself.
 */
export function BentoSpotlight() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const grid = ref.current?.closest<HTMLElement>("[data-bento]");
    if (!grid || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const tiles = Array.from(grid.querySelectorAll<HTMLElement>(".bento-tile"));
    let raf = 0;
    let ev: PointerEvent | null = null;
    const paint = () => {
      raf = 0;
      if (!ev) return;
      for (const t of tiles) {
        const r = t.getBoundingClientRect();
        t.style.setProperty("--mx", `${ev.clientX - r.left}px`);
        t.style.setProperty("--my", `${ev.clientY - r.top}px`);
      }
    };
    const onMove = (e: PointerEvent) => {
      ev = e;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    grid.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      grid.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
  return <span ref={ref} hidden />;
}
