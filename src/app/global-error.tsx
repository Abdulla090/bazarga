"use client";
// Last-resort boundary: replaces the root layout when it itself throws, so it renders its own <html> and
// carries inline styles (no CSS or i18n is guaranteed to load). Kurdish first, with the other locales beneath.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ckb" dir="rtl">
      <body style={{ margin: 0, background: "#FAF7F0", color: "#0F1B2D", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
          <div style={{ display: "grid", gap: 12, justifyItems: "center" }}>
            <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>هەڵەیەک ڕوویدا. تکایە دووبارە هەوڵ بدەرەوە.</p>
            <p style={{ margin: 0, opacity: 0.7 }}>Something went wrong. · حدث خطأ ما.</p>
            <button
              type="button"
              onClick={reset}
              style={{ minHeight: 44, padding: "0 24px", fontSize: 16, fontWeight: 700, background: "#F5B700", color: "#0F1B2D", border: 0, borderRadius: 12 }}
            >
              دووبارە هەوڵ بدەرەوە · Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
