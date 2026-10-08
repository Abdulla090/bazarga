"use client";
import type { ReactNode } from "react";
import { markLinkSharedAction } from "@/server/actions/setup";

/**
 * Wraps share-kit controls (copy, download, WhatsApp). A click on any link or button inside records the
 * checklist's "share your link" step. Fire-and-forget: the click is never delayed, and the server action is
 * idempotent (only the first share is stored), so repeat clicks cost one cheap UPDATE … WHERE link_shared_at IS NULL.
 */
export function RecordShareClicks({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={className}
      data-record-share=""
      onClickCapture={(e) => {
        const el = (e.target as Element | null)?.closest?.("a,button");
        if (!el || !e.currentTarget.contains(el)) return;
        void markLinkSharedAction().catch(() => {});
      }}
    >
      {children}
    </div>
  );
}
