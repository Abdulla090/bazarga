"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { CART_ADDED, type AddedItem } from "./cart";
import { pixelsConsented } from "./consent";
import { safePixelId, trackingAllowed, vendorEvent, type PixelData, type PixelEvent } from "@/lib/pixels-client";

/* eslint-disable @typescript-eslint/no-explicit-any */
type W = Window & { ttq?: any; fbq?: any; TiktokAnalyticsObject?: string; _fbq?: unknown };

let started = false;
const ids: { tiktok: string | null; meta: string | null } = { tiktok: null, meta: null };
const pending: Array<[PixelEvent, PixelData | undefined]> = [];

function send(event: PixelEvent, data?: PixelData) {
  const w = window as W;
  if (ids.tiktok && w.ttq) {
    const e = vendorEvent("tiktok", event, data);
    w.ttq.track(e.name, e.params);
  }
  if (ids.meta && w.fbq) {
    const e = vendorEvent("meta", event, data);
    w.fbq("track", e.name, e.params);
  }
}

/** Fire a pixel event; queued until the seller's pixel has loaded. A no-op when the store has no pixel or tracking is refused. */
export function pixelTrack(event: PixelEvent, data?: PixelData) {
  if (started) send(event, data);
  else if (pending.length < 20) pending.push([event, data]);
}

function loadTikTok(id: string) {
  const w = window as W;
  const t = "ttq";
  w.TiktokAnalyticsObject = t;
  const ttq: any = (w.ttq = w.ttq || []);
  ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
  ttq.setAndDefer = (o: any, m: string) => {
    o[m] = (...a: unknown[]) => o.push([m, ...a]);
  };
  for (const m of ttq.methods) ttq.setAndDefer(ttq, m);
  ttq.instance = (x: string) => {
    const inst = ttq._i[x] || [];
    for (const m of ttq.methods) ttq.setAndDefer(inst, m);
    return inst;
  };
  const src = "https://analytics.tiktok.com/i18n/pixel/events.js";
  ttq.load = (pid: string, opts?: unknown) => {
    ttq._i = ttq._i || {};
    ttq._i[pid] = [];
    ttq._i[pid]._u = src;
    ttq._t = ttq._t || {};
    ttq._t[pid] = +new Date();
    ttq._o = ttq._o || {};
    ttq._o[pid] = opts || {};
    const s = document.createElement("script");
    s.async = true;
    s.src = `${src}?sdkid=${encodeURIComponent(pid)}&lib=${t}`;
    document.head.appendChild(s);
  };
  ttq.load(id);
  ttq.page();
}

function loadMeta(id: string) {
  const w = window as W;
  if (w.fbq) return;
  const n: any = (w.fbq = (...a: unknown[]) => (n.callMethod ? n.callMethod(...a) : n.queue.push(a)));
  if (!w._fbq) w._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  n("init", id);
  n("track", "PageView");
}

/**
 * The seller's own TikTok / Meta pixels (S5). Mounted once in the storefront layout. Loads after the shopper's first
 * interaction (keeps Lighthouse clean), never when Do Not Track / Global Privacy Control is on. Fires PageView on
 * every route change, AddToCart on the cart's add event; ViewContent / Purchase come from <PixelEvent/>.
 */
export function SellerPixels({ tiktokId, metaId }: { tiktokId: string | null; metaId: string | null }) {
  const pathname = usePathname();

  useEffect(() => {
    const tt = safePixelId("tiktok", tiktokId);
    const mt = safePixelId("meta", metaId);
    if (!tt && !mt) return;
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (!trackingAllowed({ doNotTrack: nav.doNotTrack, globalPrivacyControl: nav.globalPrivacyControl })) return;
    const start = () => {
      if (started || !pixelsConsented()) return;
      started = true;
      ids.tiktok = tt;
      ids.meta = mt;
      if (tt) loadTikTok(tt);
      if (mt) loadMeta(mt);
      for (const [e, d] of pending.splice(0)) send(e, d);
    };
    const opts = { once: true, passive: true } as const;
    const evs = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    for (const e of evs) window.addEventListener(e, start, opts);
    const timer = window.setTimeout(start, 6000);
    const onAdd = (e: Event) => {
      const item = (e as CustomEvent<AddedItem>).detail;
      pixelTrack("AddToCart", { name: item?.name, quantity: item?.qty });
    };
    window.addEventListener(CART_ADDED, onAdd);
    return () => {
      for (const e of evs) window.removeEventListener(e, start);
      window.clearTimeout(timer);
      window.removeEventListener(CART_ADDED, onAdd);
    };
  }, [tiktokId, metaId]);

  // PageView on client-side navigation (the first one is fired by the vendor snippet itself).
  useEffect(() => {
    if (!started) return;
    const w = window as W;
    if (ids.tiktok && w.ttq) w.ttq.page();
    if (ids.meta && w.fbq) w.fbq("track", "PageView");
  }, [pathname]);

  return null;
}

/** Fire one pixel event when this mounts (product page → ViewContent, order page → Purchase, once per `dedupeKey`). */
export function PixelEvent({ event, data, dedupeKey }: { event: PixelEvent; data?: PixelData; dedupeKey?: string }) {
  useEffect(() => {
    if (dedupeKey) {
      const k = `bz-px-${event}-${dedupeKey}`;
      try {
        if (window.sessionStorage.getItem(k)) return;
        window.sessionStorage.setItem(k, "1");
      } catch {
        /* private mode: fire anyway */
      }
    }
    pixelTrack(event, data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
