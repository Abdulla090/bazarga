"use client";

import type { ComponentProps } from "react";

/**
 * A WhatsApp link that also tells seller analytics a shopper tapped it (`/api/v/<slug>?w=1`, counted once per visitor
 * per day, no cookies). The link itself navigates exactly as before; the count is a fire-and-forget request.
 */
export function WaTap({ slug, onClick, ...rest }: ComponentProps<"a"> & { slug: string }) {
  return (
    <a
      {...rest}
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
