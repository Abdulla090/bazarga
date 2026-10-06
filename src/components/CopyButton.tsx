"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function CopyButton({ text }: { text: string }) {
  const t = useTranslations("common");
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-ink btn-sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? t("copied") : t("copy")}
    </button>
  );
}
