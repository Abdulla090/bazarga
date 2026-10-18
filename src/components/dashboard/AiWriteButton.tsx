"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { writeProductCopyAction } from "@/server/actions/ai";
import type { Locale } from "@/lib/i18n";

export type AiMode = "on" | "locked" | "connect" | "hidden";

/** Set an uncontrolled input's value so React and the browser both see it. */
function fill(id: string, value: string) {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el) return;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? "";

/**
 * SF5 "Write with AI" (Business+): reads what the seller typed in the current language tab, fills the name and
 * description there, and offers hashtags to copy or add. Locked plans see an upgrade link; no provider → operators
 * see a "connect AI" note and sellers see nothing.
 */
export function AiWriteButton({ mode, lang }: { mode: AiMode; lang: Locale }) {
  const t = useTranslations("aiWrite");
  const te = useTranslations("errors");
  const tu = useTranslations("upgrade");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  if (mode === "hidden") return null;
  if (mode === "connect")
    return (
      <p className="hint rounded-xl border border-dashed border-line p-3" data-testid="ai-connect">
        {t("connect")}
      </p>
    );
  if (mode === "locked")
    return (
      <Link href="/dashboard/upgrade" data-testid="ai-locked" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold">
        <Sparkle /> {t("button")} · <span className="text-[#2563EB]">{tu("name.business")}</span>
      </Link>
    );

  const run = () =>
    start(async () => {
      setError(null);
      setCopied(false);
      const hint = [val(`name-${lang}`), val(`desc-${lang}`)].filter(Boolean).join("\n") || ["ku", "ar", "en", "kmr"].map((l) => val(`name-${l}`)).find(Boolean) || "";
      const cat = document.getElementById("f-cat") as HTMLSelectElement | null;
      const category = cat && cat.value ? cat.selectedOptions[0]?.textContent ?? null : null;
      const price = (document.querySelector('input[name="price"]') as HTMLInputElement | null)?.value ?? "";
      const res = await writeProductCopyAction({ lang, hint, category, price: price || null });
      if (!res.ok || !res.copy) {
        setError(res.fieldErrors?.hint ? "hint_required" : res.error ?? "generic");
        return;
      }
      fill(`name-${lang}`, res.copy.title);
      fill(`desc-${lang}`, res.copy.description);
      setTags(res.copy.hashtags);
      setLeft(res.remaining ?? null);
    });

  return (
    <div className="grid gap-2" data-testid="ai-write">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={run} disabled={pending} aria-busy={pending || undefined} data-testid="ai-write-btn" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-60">
          <Sparkle /> {pending ? t("writing") : t("button")}
        </button>
        <span className="hint">{left !== null ? t("left", { count: left }) : t("hint")}</span>
      </div>
      {error && (
        <p role="alert" className="field-error" data-testid="ai-write-error">
          {error === "hint_required" ? t("needHint") : error === "plan_limit_ai" ? t("quota") : error === "RATE_LIMITED" ? t("slowDown") : te.has(error) ? te(error) : te("generic")}
        </p>
      )}
      {tags.length > 0 && (
        <div className="grid gap-2 rounded-xl border border-line bg-paper p-3" data-testid="ai-hashtags">
          <p className="text-sm font-semibold">{t("hashtags")}</p>
          <ul className="flex flex-wrap gap-1.5" data-testid="ai-tag-list">
            {tags.map((tag) => (
              <li key={tag} className="rounded-full bg-[#2563EB]/10 px-2.5 py-1 text-sm font-medium leading-normal text-[#2563EB]">
                <bdi>{tag}</bdi>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost btn-sm min-h-11" onClick={() => void navigator.clipboard?.writeText(tags.join(" ")).then(() => setCopied(true))}>
              {copied ? t("copied") : t("copy")}
            </button>
            <button type="button" className="btn-ghost btn-sm min-h-11" data-testid="ai-add-tags" onClick={() => fill(`desc-${lang}`, `${val(`desc-${lang}`).trim()}\n\n${tags.join(" ")}`.trim())}>
              {t("addTags")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Sparkle() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 2l1.8 5.6L19.5 9l-5.7 1.6L12 16l-1.8-5.4L4.5 9l5.7-1.4L12 2zm7 12l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14z" />
    </svg>
  );
}
