"use client";
import { useEffect, useRef } from "react";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { SIZES } from "@/lib/responsive-image";
import type { GalleryImage } from "./ProductGallery";

/**
 * Thumbnail strip: a horizontal scroller under the photo on phones (56 px, comfortably above the 44 px target),
 * a vertical rail beside it from `md` up. Split from the gallery so single-photo products never download it.
 */
export default function GalleryThumbs({
  images,
  active,
  onPick,
  label,
}: {
  images: GalleryImage[];
  active: number;
  onPick: (i: number) => void;
  label: { photo: string; of: string };
}) {
  const list = useRef<HTMLUListElement>(null);
  // Keep the active thumbnail visible in the phone strip without scrolling the page.
  useEffect(() => {
    const ul = list.current;
    const li = ul?.children[active] as HTMLElement | undefined;
    if (!ul || !li || ul.scrollWidth <= ul.clientWidth) return;
    const target = li.offsetLeft - (ul.clientWidth - li.clientWidth) / 2;
    ul.scrollTo({ left: target, behavior: "smooth" });
  }, [active]);

  return (
    <ul
      ref={list}
      className="flex gap-2 overflow-x-auto px-0.5 py-0.5 [scrollbar-width:none] md:order-1 md:grid md:content-start md:overflow-visible [&::-webkit-scrollbar]:hidden"
      data-testid="gallery-thumbs"
    >
      {images.map((img, i) => (
        <li key={img.id} className="shrink-0">
          <button
            type="button"
            onClick={() => onPick(i)}
            aria-label={`${label.photo} ${i + 1} ${label.of} ${images.length}`}
            aria-current={i === active || undefined}
            className={`block h-14 w-14 overflow-hidden rounded-xl border-2 md:h-auto md:w-full ${i === active ? "border-st-fg" : "border-transparent opacity-70 hover:opacity-100"}`}
          >
            <ResponsiveImage image={img} alt="" sizes={SIZES.thumb} index={i} aboveTheFold={0} className="aspect-square h-full w-full object-cover" />
          </button>
        </li>
      ))}
    </ul>
  );
}
