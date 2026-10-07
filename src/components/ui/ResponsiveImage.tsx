import type { CSSProperties } from "react";
import { imageProps, placeholderStyle, type ImageLike } from "@/lib/responsive-image";

/**
 * <img> with the pipeline's WebP srcset, intrinsic width/height (no layout shift), blur-up placeholder and
 * priority/lazy loading by position. Plain <img> on purpose: renditions are already resized at upload, so
 * next/image's on-demand optimizer would only add a second resize and a serverless hop per image.
 */
export function ResponsiveImage({
  image,
  alt,
  sizes,
  index = 0,
  aboveTheFold = 1,
  className,
  style,
}: {
  image: ImageLike;
  alt: string;
  sizes: string;
  /** Position on the page: index < aboveTheFold → eager + fetchpriority=high (LCP); the rest are lazy. */
  index?: number;
  aboveTheFold?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const p = imageProps(image, { sizes, index, aboveTheFold, alt });
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see component doc
    <img
      src={p.src}
      srcSet={p.srcSet}
      sizes={p.sizes}
      width={p.width}
      height={p.height}
      alt={p.alt}
      loading={p.loading}
      fetchPriority={p.fetchPriority}
      decoding={p.decoding}
      className={className}
      style={{ ...placeholderStyle(image), ...style }}
    />
  );
}
