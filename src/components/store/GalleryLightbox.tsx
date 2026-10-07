"use client";
import { useEffect, useRef, useState } from "react";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { Icon, X } from "@/components/ui/icons";
import type { GalleryImage, GalleryLabels } from "./ProductGallery";

const MAX_ZOOM = 4;
const TAP_ZOOM = 2.5;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Fullscreen photo viewer (lazy chunk, loaded on the first tap). A modal <dialog> gives focus trapping, Esc to
 * close and an inert page for free. Photos swipe on a scroll-snap strip; each photo zooms with a two-finger pinch,
 * a double tap or the zoom button, and pans with native scrolling while zoomed (the strip stops snapping then).
 */
export default function GalleryLightbox({
  images,
  start,
  alt,
  label,
  onClose,
}: {
  images: GalleryImage[];
  start: number;
  alt: string;
  label: GalleryLabels;
  onClose: (last: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(start);
  const [zoom, setZoom] = useState(1);
  const activeRef = useRef(start);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const d = dialog.current;
    const el = strip.current;
    if (!d || !el) return;
    d.showModal();
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollTo({ left: start * el.clientWidth * (rtl ? -1 : 1), behavior: "instant" });
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevOverflow;
    };
  }, [start]);

  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(Math.abs(el.scrollLeft) / Math.max(1, el.clientWidth));
        if (i !== activeRef.current) {
          setActive(i);
          setZoom(1);
        }
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  function go(i: number) {
    const el = strip.current;
    if (!el) return;
    const n = clamp(i, 0, images.length - 1);
    setZoom(1);
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollTo({ left: n * el.clientWidth * (rtl ? -1 : 1), behavior: "smooth" });
    setActive(n);
  }

  function close() {
    dialog.current?.close();
  }

  return (
    <dialog
      ref={dialog}
      onClose={() => onClose(activeRef.current)}
      onKeyDown={(e) => {
        const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
        if (e.key === "ArrowRight") go(active + (rtl ? -1 : 1));
        if (e.key === "ArrowLeft") go(active + (rtl ? 1 : -1));
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black"
      aria-label={alt}
      data-testid="lightbox"
    >
      <div className="relative flex h-full flex-col">
        <div
          className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent px-3 pb-6"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <span className="num rounded-full bg-white/15 px-3 py-1 text-sm font-bold" dir="ltr" data-testid="lightbox-counter">
            {active + 1}/{images.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom((z) => (z > 1 ? 1 : TAP_ZOOM))}
              aria-pressed={zoom > 1}
              className="inline-flex h-11 min-w-11 items-center justify-center rounded-full bg-white/15 px-3 text-sm font-bold"
            >
              {zoom > 1 ? "1×" : `${TAP_ZOOM}×`}
              <span className="sr-only"> {label.zoom}</span>
            </button>
            <button type="button" onClick={close} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15" autoFocus>
              <Icon as={X} label={label.close} />
            </button>
          </div>
        </div>

        <div
          ref={strip}
          className={`flex h-full ${zoom > 1 ? "overflow-hidden" : "snap-x snap-mandatory overflow-x-auto"} overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        >
          {images.map((img, i) => (
            <ZoomSlide
              key={img.id}
              image={img}
              alt={i === 0 ? alt : `${label.photo} ${i + 1} ${label.of} ${images.length}`}
              zoom={i === active ? zoom : 1}
              onZoom={setZoom}
              eager={Math.abs(i - start) <= 1}
            />
          ))}
        </div>

        {images.length > 1 && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-3"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={() => go(active - 1)}
              disabled={active === 0}
              className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-xl font-bold disabled:opacity-30"
              aria-label={label.prev}
            >
              <span aria-hidden className="rtl:-scale-x-100">‹</span>
            </button>
            <button
              type="button"
              onClick={() => go(active + 1)}
              disabled={active === images.length - 1}
              className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-xl font-bold disabled:opacity-30"
              aria-label={label.next}
            >
              <span aria-hidden className="rtl:-scale-x-100">›</span>
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}

/** One photo: fit to screen at 1×; when zoomed the image grows inside a native scroll box so panning is just scrolling. */
function ZoomSlide({
  image,
  alt,
  zoom,
  onZoom,
  eager,
}: {
  image: GalleryImage;
  alt: string;
  zoom: number;
  onZoom: (z: number) => void;
  eager: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  const lastTap = useRef(0);

  // Two-finger pinch with touch events (pointer events get cancelled once the browser starts a pan).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let startDist = 0;
    let startZoom = 1;
    const dist = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = dist(e.touches);
        startZoom = zoomRef.current;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !startDist) return;
      e.preventDefault();
      onZoom(clamp(startZoom * (dist(e.touches) / startDist), 1, MAX_ZOOM));
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) startDist = 0;
      if (zoomRef.current < 1.05) onZoom(1);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [onZoom]);

  // Keep the middle of the photo in view when the zoom level changes.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }, [zoom]);

  return (
    <div
      ref={box}
      dir="ltr"
      className={`h-full w-full shrink-0 snap-center snap-always [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${zoom > 1 ? "overflow-auto" : "overflow-hidden"}`}
      style={{ touchAction: zoom > 1 ? "pan-x pan-y" : "pan-x" }}
      onClick={() => {
        const now = Date.now();
        if (now - lastTap.current < 300) onZoom(zoom > 1 ? 1 : TAP_ZOOM);
        lastTap.current = now;
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, minWidth: "100%", minHeight: "100%" }}
      >
        <ResponsiveImage
          image={image}
          alt={alt}
          sizes={`${Math.round(zoom * 100)}vw`}
          index={eager ? 0 : 1}
          aboveTheFold={eager ? 1 : 0}
          className="max-h-full max-w-full object-contain"
          style={{ width: "100%", height: "100%", objectFit: "contain", backgroundImage: "none", backgroundColor: "transparent" }}
        />
      </div>
    </div>
  );
}
