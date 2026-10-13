"use client";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon, Plus } from "@/components/ui/icons";

export type FaqItem = { q: string; a: string };

/** Single-open rule: clicking the open item closes it; clicking another opens it and closes the rest. */
export function toggleFaq(open: number | null, i: number): number | null {
  return open === i ? null : i;
}

/**
 * Landing FAQ accordion: one item open at a time. Each header is a real <button aria-expanded aria-controls> inside
 * an <h3>; its answer is a role="region" labelled by that button. Arrow Up/Down, Home and End move between headers.
 * The macOS-style open (height via grid rows 0fr→1fr, content scale .96→1 from the icon corner, opacity, blur 6px→0)
 * is pure CSS in marketing.css on [data-open]; closed panels are visibility:hidden, so nothing inside is focusable.
 */
export function FaqList({ items, initialOpen = null }: { items: FaqItem[]; initialOpen?: number | null }) {
  const [open, setOpen] = useState<number | null>(initialOpen);
  const base = useId();
  const btns = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = items.length - 1;
    const to = e.key === "ArrowDown" ? (i === last ? 0 : i + 1) : e.key === "ArrowUp" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (to < 0) return;
    e.preventDefault();
    btns.current[to]?.focus();
  };

  return (
    <div className="faq" data-faq>
      {items.map((it, i) => {
        const isOpen = open === i;
        const bid = `${base}-q${i}`;
        const pid = `${base}-a${i}`;
        return (
          <div key={i} className="faq-item" data-open={isOpen || undefined}>
            <h3 className="m-0">
              <button
                ref={(el) => {
                  btns.current[i] = el;
                }}
                id={bid}
                type="button"
                className="faq-btn"
                aria-expanded={isOpen}
                aria-controls={pid}
                onClick={() => setOpen((o) => toggleFaq(o, i))}
                onKeyDown={(e) => onKey(e, i)}
              >
                <span className="faq-q">{it.q}</span>
                <span className="faq-icon" aria-hidden="true">
                  <Icon as={Plus} />
                </span>
              </button>
            </h3>
            <div id={pid} role="region" aria-labelledby={bid} className="faq-panel" data-open={isOpen || undefined}>
              <div className="faq-clip">
                <p className="faq-a">{it.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
