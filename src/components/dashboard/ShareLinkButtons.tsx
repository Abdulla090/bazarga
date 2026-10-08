"use client";
import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { markLinkSharedAction } from "@/server/actions/setup";
import { Icon, Share2 } from "@/components/ui/icons";

const noop = () => () => {};
// Literal class names so Tailwind sees them.
const BTN = { ink: "btn-ink btn-sm", ghost: "btn-ghost btn-sm", gold: "btn-gold btn-sm" } as const;

/**
 * Copy (and, where the browser supports it, native share) for the store link. Either one records the
 * "share your link" setup step; that call is fire-and-forget so the button never waits on the network.
 */
export function ShareLinkButtons({ url, title, variant = "ink" }: { url: string; title: string; variant?: "ink" | "ghost" | "gold" }) {
  const tc = useTranslations("common");
  const t = useTranslations("setup");
  const [copied, setCopied] = useState(false);
  const record = () => void markLinkSharedAction().catch(() => {});
  // false on the server and during hydration, then the real answer: no hydration mismatch.
  const canShare = useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);
  const cls = BTN[variant];
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className={cls}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
            record();
          } catch {
            /* clipboard blocked: the link is still visible to copy by hand */
          }
        }}
      >
        {copied ? tc("copied") : tc("copy")}
      </button>
      {canShare && (
        <button
          type="button"
          className={cls}
          onClick={async () => {
            try {
              await navigator.share({ title, url });
              record();
            } catch {
              /* cancelled */
            }
          }}
        >
          <Icon as={Share2} /> {t("shareNative")}
        </button>
      )}
    </div>
  );
}
