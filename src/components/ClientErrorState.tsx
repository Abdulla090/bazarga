"use client";
import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { Icon, RotateCcw } from "@/components/ui/icons";
import { errorText } from "./error-text";

const subscribe = () => () => {};
const SUPPORT_EMAIL = "founder@kurdistanai.app";

/** Client half of the error states (error boundaries must be client components). Same look as ErrorState. */
export function ClientErrorState({
  error,
  reset,
  variant = "page",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  variant?: "page" | "dashboard";
}) {
  const lang = useSyncExternalStore(subscribe, () => document.documentElement.lang, () => "ckb");
  const t = errorText(lang);
  useEffect(() => {
    // The server already logged it (src/instrumentation.ts) under this digest; keep a client trace for support.
    console.error("[bazarga] render error", error.digest ?? error.message);
  }, [error]);
  const dash = variant === "dashboard";
  return (
    <section className="mx-auto grid w-full max-w-xl justify-items-center gap-5 px-5 py-14 text-center sm:py-20" data-testid={dash ? "dashboard-error" : "error-page"} role="alert">
      <p aria-hidden="true" dir="ltr" className="num select-none bg-gradient-to-b from-ink via-ink to-[#2563EB] bg-clip-text text-[clamp(5.5rem,24vw,9.5rem)] font-extrabold leading-none tracking-tighter text-transparent">
        500
      </p>
      <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink-70">
        <span className="size-1.5 rounded-full bg-[#2563EB]" aria-hidden="true" />
        {t.eyebrow}
      </p>
      <h1 className="text-balance text-2xl font-bold tracking-tight text-ink sm:text-3xl">{t.title}</h1>
      <p className="max-w-md text-pretty text-base leading-relaxed text-ink-70">{dash ? t.dashBody : t.body}</p>
      <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
        <button type="button" className="btn-gold min-h-12 justify-center px-7" onClick={reset}>
          <Icon as={RotateCcw} /> {t.retry}
        </button>
        <Link href={dash ? "/dashboard" : "/"} className="btn-ghost min-h-12 justify-center px-7">{dash ? t.dashboard : t.home}</Link>
      </div>
      <p className="mt-2 text-sm text-ink-70">
        {t.help}{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-[#2563EB] underline-offset-4 hover:underline" dir="ltr">{SUPPORT_EMAIL}</a>
      </p>
      {error.digest ? <p className="num text-xs text-ink-70" dir="ltr">{t.ref}: {error.digest}</p> : null}
    </section>
  );
}
