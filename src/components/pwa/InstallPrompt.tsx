"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "mm:install-dismissed";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/**
 * Seller dashboard "install the app" card: Android/desktop Chrome via `beforeinstallprompt`, iOS Safari via a
 * Share → Add to Home Screen hint. Hidden once installed or dismissed (remembered per device).
 */
export function InstallPrompt() {
  const t = useTranslations("pwa");
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // iOS never fires beforeinstallprompt; show the manual hint instead.
    const iosTimer = isIos()
      ? window.setTimeout(() => {
          setIos(true);
          setHidden(false);
        }, 0)
      : undefined;
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (iosTimer) window.clearTimeout(iosTimer);
    };
  }, []);

  if (hidden || (!evt && !ios)) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  return (
    <aside className="card flex flex-wrap items-center gap-3 border-gold/60 bg-gold/10" aria-live="polite">
      <div className="min-w-0 flex-1">
        <p className="font-bold">{t("installTitle")}</p>
        <p className="text-sm text-ink-70">{ios ? t("iosHint") : t("installSub")}</p>
      </div>
      <div className="flex gap-2">
        {evt && (
          <button
            type="button"
            className="btn-ink btn-sm"
            onClick={async () => {
              await evt.prompt();
              const { outcome } = await evt.userChoice;
              setEvt(null);
              if (outcome === "accepted") setHidden(true);
            }}
          >
            {t("installCta")}
          </button>
        )}
        <button type="button" className="btn-ghost btn-sm" onClick={dismiss}>
          {t("installDismiss")}
        </button>
      </div>
    </aside>
  );
}
