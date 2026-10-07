"use client";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { SIZES, type ImageLike } from "@/lib/responsive-image";

// Multi-photo extras live in their own chunks so the first-load storefront bundle stays inside its budget:
// the thumbnail strip is requested only when a product has several photos, the fullscreen viewer only on first tap.
// React.lazy rather than next/dynamic: no loadable runtime added to the storefront bundle.
const GalleryThumbs = lazy(() => import("./GalleryThumbs"));
const loadLightbox = () => import("./GalleryLightbox");
const GalleryLightbox = lazy(loadLightbox);

export type GalleryImage = ImageLike & { id: string };
export type GalleryLabels = { photo: string; of: string; open: string; close: string; next: string; prev: string; zoom: string };

/** Window event the variant picker fires to show a variant's photo: `detail` = product image id. */
export const GALLERY_EVENT = "mm:gallery-show";

/**
 * Swipeable product gallery with no library: a CSS scroll-snap strip (native momentum swipe on phones, works in
 * RTL because the browser mirrors the scroll axis), a "2/5" counter, dots and a thumbnail strip (horizontal on
 * phones, a rail from `md` up). Tapping a photo opens the fullscreen viewer (swipe + pinch / double-tap zoom).
 * Only the first photo loads eagerly (it is the LCP element); the rest are lazy.
 */
export function ProductGallery({ images, alt, label }: { images: GalleryImage[]; alt: string; label: GalleryLabels }) {
  const strip = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);

  // Track the slide in view. scrollLeft is negative in RTL (Chrome/Safari/Firefox agree on this now) → abs().
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setActive(Math.round(Math.abs(el.scrollLeft) / Math.max(1, el.clientWidth))));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  function go(i: number, smooth = true) {
    const el = strip.current;
    if (!el) return;
    // Slides are full width; in RTL the scroll axis runs negative from the start edge.
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollTo({ left: i * el.clientWidth * (rtl ? -1 : 1), behavior: smooth ? "smooth" : "instant" });
    setActive(i);
  }

  useEffect(() => {
    const onShow = (e: Event) => {
      const i = images.findIndex((img) => img.id === (e as CustomEvent<string>).detail);
      if (i >= 0) go(i);
    };
    window.addEventListener(GALLERY_EVENT, onShow);
    return () => window.removeEventListener(GALLERY_EVENT, onShow);
  }, [images]);

  if (!images.length) return <span className="block aspect-square rounded-[var(--radius-card)] bg-st-surface" />;
  const many = images.length > 1;

  return (
    <div className="grid gap-2 md:grid-cols-[4.5rem_1fr] md:gap-3">
      <div className="relative -mx-4 sm:mx-0 md:order-2">
        <div
          ref={strip}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="region"
          aria-roledescription="carousel"
          aria-label={alt}
          tabIndex={0}
          data-testid="gallery"
          onKeyDown={(e) => {
            const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
            if (e.key === "ArrowRight") go(Math.min(images.length - 1, Math.max(0, active + (rtl ? -1 : 1))));
            if (e.key === "ArrowLeft") go(Math.min(images.length - 1, Math.max(0, active + (rtl ? 1 : -1))));
          }}
        >
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              className="block w-full shrink-0 cursor-zoom-in snap-center snap-always"
              aria-roledescription="slide"
              aria-label={`${label.open.replace("{n}", String(i + 1))} · ${label.photo} ${i + 1} ${label.of} ${images.length}`}
              onPointerDown={() => void loadLightbox()}
              onClick={() => setViewer(i)}
            >
              <ResponsiveImage
                image={img}
                alt={i === 0 ? alt : ""}
                sizes={SIZES.productHero}
                index={i}
                className="aspect-square h-auto w-full object-cover sm:rounded-[var(--radius-card)] sm:border sm:border-st-border"
              />
            </button>
          ))}
        </div>
        {many && (
          <span
            className="num pointer-events-none absolute end-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white sm:end-3"
            dir="ltr"
            data-testid="gallery-counter"
            aria-hidden
          >
            {active + 1}/{images.length}
          </span>
        )}
      </div>

      {many && (
        <>
          <div className="flex justify-center gap-1.5 md:hidden" aria-hidden>
            {images.map((img, i) => (
              <span key={img.id} className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-st-fg" : "w-1.5 bg-st-fg/25"}`} />
            ))}
          </div>
          <Suspense fallback={<div className="h-14 md:hidden" aria-hidden />}>
            <GalleryThumbs images={images} active={active} onPick={go} label={label} />
          </Suspense>
        </>
      )}

      {viewer !== null && (
        <Suspense fallback={null}>
          <GalleryLightbox
            images={images}
            start={viewer}
            alt={alt}
            label={label}
            onClose={(last) => {
              setViewer(null);
              go(last, false);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
