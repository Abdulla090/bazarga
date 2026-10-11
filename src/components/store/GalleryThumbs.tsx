"use client";
import { useEffect, useRef } from "react";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { SIZES } from "@/lib/responsive-image";
import type { GalleryImage } from "./ProductGallery";

/**
 * Thumbnail strip: a horizontal scroller under the photo on phones (56 px, comfortably above the 44 px target),
 * a vertical rail (64×80) on the inline start of the main photo from `md` up. Split from the gallery so single-photo products never download it.
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
    if (!ul || !li) return;
    // Phone row scrolls sideways; the desktop rail scrolls vertically when there are more photos than fit.
    if (ul.scrollWidth > ul.clientWidth) ul.scrollTo({ left: li.offsetLeft - (ul.clientWidth - li.clientWidth) / 2, behavior: "smooth" });
    else if (ul.scrollHeight > ul.clientHeight) ul.scrollTo({ top: li.offsetTop - (ul.clientHeight - li.clientHeight) / 2, behavior: "smooth" });
  }, [active]);

  return (
    <ul
      ref={list}
      className="flex gap-2 overflow-x-auto px-0.5 py-0.5 [scrollbar-width:none] md:col-start-1 md:row-start-1 md:max-h-full md:flex-col md:self-start md:overflow-y-auto md:overflow-x-hidden md:px-0 [&::-webkit-scrollbar]:hidden"
      data-testid="gallery-thumbs"
    >
      {images.map((img, i) => (
        <li key={img.id} className="shrink-0">
          <button
            type="button"
            onClick={() => onPick(i)}
            aria-label={`${label.photo} ${i + 1} ${label.of} ${images.length}`}
            aria-current={i === active || undefined}
            className={`block h-14 w-14 overflow-hidden rounded-xl border bg-[#F4F4F5] transition-opacity duration-150 md:h-20 md:w-16 ${i === active ? "border-st-fg" : "border-transparent opacity-70 hover:opacity-100"}`}
          >
            <ResponsiveImage image={img} alt="" sizes={SIZES.thumb} index={i} aboveTheFold={0} className="aspect-square h-full w-full object-cover" />
          </button>
        </li>
      ))}
    </ul>
  );
}
