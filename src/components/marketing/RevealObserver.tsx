"use client";
import { useEffect } from "react";

const SETTLE_MS = 2600;
const COUNT_MS = 1400;

function countUp(el: HTMLElement) {
  const nodes = el.matches("[data-rv-count]") ? [el] : Array.from(el.querySelectorAll<HTMLElement>("[data-rv-count]"));
  for (const n of nodes) {
    const target = Number(n.dataset.rvCount);
    if (!Number.isFinite(target) || target <= 0) continue;
    const final = n.textContent ?? "";
    let fmt: Intl.NumberFormat;
    try {
      fmt = new Intl.NumberFormat(n.dataset.rvLocale || undefined);
    } catch {
      fmt = new Intl.NumberFormat("en-US");
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / COUNT_MS);
      if (p >= 1) {
        n.textContent = final;
        return;
      }
      n.textContent = fmt.format(Math.round(target * (1 - Math.pow(2, -10 * p))));
      requestAnimationFrame(step);
    };
    n.textContent = fmt.format(0);
    requestAnimationFrame(step);
  }
}

/**
 * One shared IntersectionObserver for the landing's one-time reveals. Each [data-rv] element animates once when it
 * enters the viewport (data-rv-in), is unobserved, and ~2.6 s later gets data-rv-done, which drops the transition,
 * clip-path and will-change (end state: plain, fully sharp content). Elements already on screen when this mounts are
 * marked done straight away, so nothing that was painted ever blinks out. Content is never hidden without JS or under
 * reduced motion: the hidden start states only apply while html[data-rv-on] is set. Renders nothing.
 */
export function RevealObserver() {
  useEffect(() => {
    const root = document.documentElement;
    if (typeof IntersectionObserver !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers = new Set<number>();
    const pending = new Set<HTMLElement>();
    const reveal = (el: HTMLElement) => {
      pending.delete(el);
      io.unobserve(el);
      el.setAttribute("data-rv-in", "");
      countUp(el);
      const t = window.setTimeout(() => {
        timers.delete(t);
        el.setAttribute("data-rv-done", "");
      }, SETTLE_MS);
      timers.add(t);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting || e.boundingClientRect.bottom < 0) reveal(e.target as HTMLElement);
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const vh = window.innerHeight;
    for (const el of document.querySelectorAll<HTMLElement>("[data-rv]:not([data-rv-in])")) {
      if (el.getBoundingClientRect().top < vh * 0.92) {
        el.setAttribute("data-rv-in", "");
        el.setAttribute("data-rv-done", "");
      } else pending.add(el);
    }
    root.setAttribute("data-rv-on", "");
    for (const el of pending) io.observe(el);
    // A jump past a section (End key, anchor link) never "intersects" it: reveal whatever ended up above the viewport.
    const onScrollEnd = () => {
      for (const el of [...pending]) if (el.getBoundingClientRect().bottom < 0) reveal(el);
    };
    window.addEventListener("scrollend", onScrollEnd, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scrollend", onScrollEnd);
      for (const t of timers) clearTimeout(t);
      root.removeAttribute("data-rv-on");
    };
  }, []);
  return null;
}
