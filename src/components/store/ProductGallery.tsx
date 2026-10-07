"use client";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { SIZES, type ImageLike } from "@/lib/responsive-image";

// Thumbnails are a multi-photo, md+ extra: separate chunk, only requested when a product has several photos.
// React.lazy rather than next/dynamic: no loadable runtime added to the storefront bundle.
const GalleryThumbs = lazy(() => import("./GalleryThumbs"));

export type GalleryImage = ImageLike & { id: string };

/** Window event the variant picker fires to show a variant's photo: `detail` = product image id. */
export const GALLERY_EVENT = "mm:gallery-show";

/**
 * Swipeable product gallery with no library: a CSS scroll-snap strip (native momentum swipe on phones,
 * works in RTL because the browser mirrors the scroll axis), dots on mobile, thumbnails from `md` up.
 * Only the first photo loads eagerly (it is the LCP element); the rest are lazy.
 */
export function ProductGallery({ images, alt, label }: { images: GalleryImage[]; alt: string; label: { photo: string; of: string } }) {
  const strip = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

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

  function go(i: number) {
    const el = strip.current;
    if (!el) return;
    // Slides are full width; in RTL the scroll axis runs negative from the start edge.
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollTo({ left: i * el.clientWidth * (rtl ? -1 : 1), behavior: "smooth" });
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

  if (!images.length) return <span className="block aspect-square rounded-[var(--radius-card)] bg-white" />;

  return (
    <div className="grid gap-2 md:grid-cols-[4.5rem_1fr] md:gap-3">
      <div
        ref={strip}
        className="-mx-4 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] sm:mx-0 md:order-2 [&::-webkit-scrollbar]:hidden"
        role="region"
        aria-roledescription="carousel"
        aria-label={alt}
        tabIndex={0}
        onKeyDown={(e) => {
          const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
          if (e.key === "ArrowRight") go(Math.min(images.length - 1, Math.max(0, active + (rtl ? -1 : 1))));
          if (e.key === "ArrowLeft") go(Math.min(images.length - 1, Math.max(0, active + (rtl ? 1 : -1))));
        }}
      >
        {images.map((img, i) => (
          <div
            key={img.id}
            className="w-full shrink-0 snap-center snap-always"
            role="group"
            aria-roledescription="slide"
            aria-label={`${label.photo} ${i + 1} ${label.of} ${images.length}`}
          >
            <ResponsiveImage
              image={img}
              alt={i === 0 ? alt : ""}
              sizes={SIZES.productHero}
              index={i}
              className="aspect-square h-auto w-full object-cover sm:rounded-[var(--radius-card)] sm:border sm:border-line"
            />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <>
          <div className="flex justify-center gap-1.5 md:hidden" aria-hidden>
            {images.map((img, i) => (
              <span key={img.id} className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-ink" : "w-1.5 bg-ink/25"}`} />
            ))}
          </div>
          <Suspense fallback={null}>
            <GalleryThumbs images={images} active={active} onPick={go} label={label} />
          </Suspense>
        </>
      )}
    </div>
  );
}
