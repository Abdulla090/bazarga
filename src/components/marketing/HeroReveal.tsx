"use client";
import { useEffect, useRef } from "react";

/**
 * Client island for the hero's floating cards. The server renders the visual with data-reveal="off" (cards at
 * opacity 0 + visibility hidden: nothing shows, not even a ghost or outline). After the first ~96px of scroll, or once
 * the visual crosses 60% in view after any scroll, this flips the nearest [data-hv] to data-reveal="on"; the
 * blur-in itself is CSS (globals.css .hv-reveal) and ends on filter: blur(0) + transform: none, i.e. fully sharp.
 * No inline script (nonce CSP). Reduced motion is handled in CSS (shown immediately, never blurred).
 */
export function HeroReveal({ offset = 96 }: { offset?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>("[data-hv]");
    if (!root) return;
    let io: IntersectionObserver | null = null;
    const stop = () => {
      window.removeEventListener("scroll", onScroll);
      io?.disconnect();
    };
    const show = () => {
      root.dataset.reveal = "on";
      stop();
    };
    function onScroll() {
      if (window.scrollY > offset) show();
    }
    if (typeof IntersectionObserver === "function") {
      io = new IntersectionObserver((es) => {
        if (window.scrollY > 8 && es.some((e) => e.intersectionRatio >= 0.6)) show();
      }, { threshold: 0.6 });
      io.observe(root);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return stop;
  }, [offset]);
  return <span ref={ref} hidden />;
}
