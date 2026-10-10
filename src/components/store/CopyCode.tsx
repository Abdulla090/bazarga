"use client";
import { useState } from "react";
import { Check, Copy, Icon } from "@/components/ui/icons";

/** Small outline pill that copies a discount code (Clipboard API, falls back to selecting the code). */
export function CopyCode({ code, label, done }: { code: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost btn-sm min-h-11 shrink-0 gap-1.5 px-3.5 sm:min-h-9"
      data-testid="copy-code"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          window.prompt(label, code);
        }
      }}
    >
      <Icon as={copied ? Check : Copy} />
      <span aria-live="polite">{copied ? done : label}</span>
    </button>
  );
}
