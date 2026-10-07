"use client";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { SIZES } from "@/lib/responsive-image";
import type { GalleryImage } from "./ProductGallery";

/** Desktop thumbnail rail (md+ only). Split from the gallery so single-photo products never download it. */
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
  return (
    <ul className="hidden gap-2 md:order-1 md:grid md:content-start">
      {images.map((img, i) => (
        <li key={img.id}>
          <button
            type="button"
            onClick={() => onPick(i)}
            aria-label={`${label.photo} ${i + 1} ${label.of} ${images.length}`}
            aria-current={i === active || undefined}
            className={`block overflow-hidden rounded-xl border-2 ${i === active ? "border-ink" : "border-transparent opacity-70 hover:opacity-100"}`}
          >
            <ResponsiveImage image={img} alt="" sizes={SIZES.thumb} index={i} aboveTheFold={0} className="aspect-square w-full object-cover" />
          </button>
        </li>
      ))}
    </ul>
  );
}
