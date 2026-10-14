"use client";
import { ERROR_TEXT } from "@/components/error-text";

// Last-resort boundary: replaces the root layout when it itself throws, so it renders its own <html> with inline
// styles only (no CSS, fonts or i18n are guaranteed to load). Sorani first, the other three locales beneath.
// Brand: ink #0A0A0B on paper #FAFAFB, one blue #2563EB, nothing warm.
const INK = "#0A0A0B";
const BLUE = "#2563EB";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const ku = ERROR_TEXT.ckb;
  return (
    <html lang="ckb" dir="rtl">
      <body style={{ margin: 0, background: "#FAFAFB", color: INK, fontFamily: "system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
          <div style={{ display: "grid", gap: 14, justifyItems: "center", maxWidth: 520 }}>
            <p aria-hidden="true" dir="ltr" style={{ margin: 0, fontSize: 88, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.04em", color: INK }}>
              5<span style={{ color: BLUE }}>0</span>0
            </p>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{ku.title}</h1>
            <p style={{ margin: 0, color: "#52525B", lineHeight: 1.6 }}>{ku.body}</p>
            <p dir="ltr" style={{ margin: 0, color: "#52525B", fontSize: 14 }}>
              {ERROR_TEXT.en.title} · {ERROR_TEXT.ar.title} · {ERROR_TEXT.kmr.title}
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ minHeight: 48, padding: "0 28px", fontSize: 16, fontWeight: 600, background: INK, color: "#FFFFFF", border: 0, borderRadius: 999, cursor: "pointer" }}
            >
              {ku.retry} · {ERROR_TEXT.en.retry}
            </button>
            {/* Full reload on purpose: the root layout just crashed, so client navigation is not trusted. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ color: BLUE, fontSize: 14 }}>{ku.home} · {ERROR_TEXT.en.home}</a>
            {error.digest ? <p dir="ltr" style={{ margin: 0, fontSize: 12, color: "#71717A" }}>ref {error.digest}</p> : null}
          </div>
        </main>
      </body>
    </html>
  );
}
