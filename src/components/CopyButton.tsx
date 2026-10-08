"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

/** Copies `text`; falls back to a hidden textarea + execCommand where the Clipboard API is unavailable (plain http). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.className = "fixed -start-[9999px] top-0 opacity-0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

export function CopyButton({
  text,
  label,
  className = "btn-ink btn-sm",
  testId,
}: {
  text: string;
  /** Button text; defaults to "Copy". */
  label?: string;
  className?: string;
  testId?: string;
}) {
  const t = useTranslations("common");
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      data-testid={testId}
      data-copy={text}
      onClick={async () => {
        if (!(await copyText(text))) return;
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      <span aria-live="polite">{done ? t("copied") : (label ?? t("copy"))}</span>
    </button>
  );
}
