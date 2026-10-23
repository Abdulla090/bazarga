"use client";
import { useEffect, useRef, useState } from "react";

const W = 412;
const H = 640;

/**
 * Live theme thumbnail (Theme Studio gallery): the seller's own store rendered in that theme at phone width
 * (/s/<slug>?pv=1&pvt=<id>), scaled to the card. Lazy (only loads when scrolled into view), not focusable, no pointer
 * events. Same-origin and unsandboxed on purpose (the preview bridge and fonts run inside it).
 */
export function ThemeThumb({ src, title, bg }: { src: string; title: string; bg: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.33);
  // Native iframe lazy-loading starts ~1–2.5k px early, so a phone loaded every gallery store at once (13 full
  // storefronts, 10 s+ on /dashboard/theme). Mount the iframe only when the card is within 300 px of the viewport.
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => { if (e) setScale(e.contentRect.width / W); });
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: "300px 0px" });
    io.observe(el);
    return () => { ro.disconnect(); io.disconnect(); };
  }, []);
  return (
    <div ref={box} className="relative w-full overflow-hidden rounded-lg border border-line" style={{ aspectRatio: `${W} / ${H}`, background: bg }} dir="ltr" aria-hidden>
      {near && <iframe
        src={src}
        title={title}
        loading="lazy"
        tabIndex={-1}
        className="pointer-events-none absolute left-0 top-0 border-0"
        style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "0 0" }}
      />}
    </div>
  );
}
