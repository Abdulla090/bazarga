"use client";
import { useId, type KeyboardEvent } from "react";
import { Icon, Plus } from "@/components/ui/icons";

export type FaqItem = { q: string; a: string };

/** Single-open rule (what the shared `name` on the <details> gives natively): the open item closes, another one replaces it. */
export function toggleFaq(open: number | null, i: number): number | null {
  return open === i ? null : i;
}

/**
 * Landing FAQ accordion, native <details>/<summary> (Oct 18 Brave fix). Opening never depends on JavaScript: no React
 * state, no click handler, no preventDefault. The browser toggles [open] itself, so an answer opens the moment the HTML
 * is painted, before (or without) hydration, with Brave Shields, script blocking or storage blocked. All items share one
 * `name`, so the browser keeps one open at a time (exclusive accordion); older engines simply allow several.
 * The open animation is CSS only (marketing.css): ::details-content block-size 0 → auto via interpolate-size, and the
 * answer fades/de-blurs in from @starting-style. Where unsupported it just opens instantly. The answer's resting style is
 * fully visible, so nothing can leave it hidden. The only JS is an optional enhancement: Arrow Up/Down, Home and End move
 * focus between questions.
 */
export function FaqList({ items, initialOpen = null }: { items: FaqItem[]; initialOpen?: number | null }) {
  const base = useId();
  const group = `faq${base.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const all = Array.from(e.currentTarget.closest("[data-faq]")?.querySelectorAll<HTMLElement>("summary.faq-btn") ?? []);
    const i = all.indexOf(e.currentTarget);
    if (i < 0) return;
    const last = all.length - 1;
    const to = e.key === "ArrowDown" ? (i === last ? 0 : i + 1) : e.key === "ArrowUp" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : last;
    e.preventDefault();
    all[to]?.focus();
  };

  return (
    <div className="faq" data-faq>
      {items.map((it, i) => (
        <details key={i} className="faq-item" name={group} open={initialOpen === i || undefined} data-faq-item>
          <summary className="faq-btn" onKeyDown={onKey}>
            <h3 className="faq-q">{it.q}</h3>
            <span className="faq-icon" aria-hidden="true">
              <Icon as={Plus} />
            </span>
          </summary>
          <div className="faq-panel">
            <p className="faq-a">{it.a}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
