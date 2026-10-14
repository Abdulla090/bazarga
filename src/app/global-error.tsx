"use client";
// Last-resort boundary: replaces the root layout when it itself throws, so it renders its own <html> with inline
// styles only (no CSS, fonts or i18n are guaranteed to load). It ships in every route's first-load JS, so it stays
// tiny: Sorani first, English beneath. Brand: ink #0A0A0B on paper #FAFAFB, one blue #2563EB, nothing warm.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ckb" dir="rtl">
      <body style={{ margin: 0, background: "#FAFAFB", color: "#0A0A0B", fontFamily: "system-ui,sans-serif" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
          <div style={{ display: "grid", gap: 14, justifyItems: "center" }}>
            <p dir="ltr" style={{ margin: 0, fontSize: 88, fontWeight: 800, lineHeight: 1 }}>
              5<span style={{ color: "#2563EB" }}>0</span>0
            </p>
            <h1 style={{ fontSize: 24, margin: 0 }}>شتێک بە هەڵەدا چوو</h1>
            <p dir="ltr" style={{ margin: 0, color: "#52525B" }}>Something went wrong</p>
            <button type="button" onClick={reset} style={{ minHeight: 48, padding: "0 28px", fontSize: 16, background: "#0A0A0B", color: "#fff", border: 0, borderRadius: 999 }}>
              دووبارە هەوڵ بدەرەوە · Try again
            </button>
            {error.digest ? <p dir="ltr" style={{ margin: 0, fontSize: 12, color: "#71717A" }}>ref {error.digest}</p> : null}
          </div>
        </main>
      </body>
    </html>
  );
}
