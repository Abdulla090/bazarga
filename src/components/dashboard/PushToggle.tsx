"use client";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { subscribePushAction, unsubscribePushAction } from "@/server/actions/dashboard";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Subscribe / unsubscribe this device to new-order push alerts. Rendered only when VAPID is configured. */
export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const t = useTranslations("pwa");
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: State;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) next = "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        next = sub ? "on" : "off";
      }
      if (!cancelled) setState(next);
    })().catch(() => !cancelled && setState("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = () =>
    start(async () => {
      setError(false);
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return;
        }
        // Dev builds don't auto-register the worker; register on demand so the toggle works everywhere.
        const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
        await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }));
        const res = await subscribePushAction(sub.toJSON());
        if (!res.ok) throw new Error(res.error);
        setState("on");
      } catch {
        setError(true);
      }
    });

  const disable = () =>
    start(async () => {
      setError(false);
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await unsubscribePushAction(sub.endpoint);
          await sub.unsubscribe();
        }
        setState("off");
      } catch {
        setError(true);
      }
    });

  return (
    <section className="card grid gap-3" aria-labelledby="push-title">
      <div>
        <h2 id="push-title" className="text-lg font-bold">{t("pushTitle")}</h2>
        <p className="text-sm text-ink-70">{t("pushSub")}</p>
      </div>
      {state === "unsupported" && <p className="text-sm text-ink-70">{t("pushUnsupported")}</p>}
      {state === "denied" && <p className="text-sm text-danger">{t("pushDenied")}</p>}
      {state === "on" && <p className="text-sm font-semibold text-green-deep">{t("pushEnabled")}</p>}
      {(state === "off" || state === "on") && (
        <div>
          <button
            type="button"
            role="switch"
            aria-checked={state === "on"}
            className={state === "on" ? "btn-ghost" : "btn-ink"}
            disabled={pending}
            onClick={state === "on" ? disable : enable}
          >
            {state === "on" ? t("pushOff") : t("pushOn")}
          </button>
        </div>
      )}
      {error && <p className="field-error" role="alert">{t("pushError")}</p>}
    </section>
  );
}
