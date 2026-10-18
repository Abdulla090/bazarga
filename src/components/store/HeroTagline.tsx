"use client";
import { useSyncExternalStore } from "react";

/**
 * Hero tagline. In the Theme Studio preview the AI Website Designer (SF10) posts a draft tagline; PreviewBridge puts
 * it here and React renders it, so the server HTML is never mutated under React (no hydration mismatch, and the
 * draft survives late hydration of the hero). Outside the preview the draft is always null.
 */
let draft: string | null = null;
const subs = new Set<() => void>();
export function setPreviewTagline(v: string | null) {
  draft = v ? v.slice(0, 140) : null;
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

export function HeroTagline({ text, className, as = "p" }: { text: string; className?: string; as?: "p" | "span" }) {
  const d = useSyncExternalStore(subscribe, () => draft, () => null);
  const Tag = as;
  return (
    <Tag data-hero-tagline className={className}>
      {d ?? text}
    </Tag>
  );
}
