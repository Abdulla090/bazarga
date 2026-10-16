"use client";

import { useEffect, useState, type ComponentProps } from "react";

/**
 * A WhatsApp link that also tells seller analytics a shopper tapped it (`/api/v/<slug>?w=1`, counted once per visitor
 * per day, no cookies). The link itself navigates exactly as before; the count is a fire-and-forget request.
 *
 * `revealOnScroll` (the floating chat button): below `sm` it stays hidden (visibility, so not focusable either) until
 * the shopper scrolls a little, so in the first viewport it never covers the coupon / delivery line. From `sm` up it
 * is always visible. It is position:fixed, so showing it moves nothing (no CLS).
 */
export function WaTap({
  slug,
  onClick,
  revealOnScroll = false,
  className = "",
  ...rest
}: ComponentProps<"a"> & { slug: string; revealOnScroll?: boolean }) {
  const [shown, setShown] = useState(!revealOnScroll);
  useEffect(() => {
    if (!revealOnScroll) return;
    const on = () => setShown(window.scrollY > 160);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [revealOnScroll]);
  const reveal = revealOnScroll
    ? `motion-safe:transition-[opacity,transform,visibility,background-color] motion-safe:duration-200 ${shown ? "" : "max-sm:invisible max-sm:translate-y-4 max-sm:opacity-0"}`
    : "";
  return (
    <a
      {...rest}
      data-shown={revealOnScroll ? shown : undefined}
      className={`${className} ${reveal}`.trim()}
      onClick={(e) => {
        onClick?.(e);
        try {
          void fetch(`/api/v/${slug}?w=1`, { keepalive: true, credentials: "omit", cache: "no-store" }).catch(() => {});
        } catch {
          /* counting must never get in the way of the chat */
        }
      }}
    />
  );
}
