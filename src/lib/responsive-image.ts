/**
 * Responsive image helpers shared by server and client components (no Node APIs).
 * Pipeline renditions (src/server/storage/pipeline.ts) are served as-is — the app does NOT route them through
 * Next's on-demand optimizer (no second resize, no extra serverless invocations): `srcSet` lists the stored WebP
 * widths and the browser picks one from `sizes`.
 */
export type RenditionLike = { width: number; height: number; url: string };
export type ImageLike = {
  url: string;
  width?: number | null;
  height?: number | null;
  placeholder?: string | null;
  dominantColor?: string | null;
  renditions?: readonly RenditionLike[] | null;
};

export function buildSrcSet(renditions: readonly RenditionLike[] | null | undefined): string | undefined {
  if (!renditions?.length) return undefined;
  return [...renditions]
    .sort((a, b) => a.width - b.width)
    .map((r) => `${r.url} ${r.width}w`)
    .join(", ");
}

/** Common `sizes` presets for the storefront layouts. */
export const SIZES = {
  /**
   * 2-col grid on phones, 3 on tablets, 4 on desktop inside a max-w-6xl container. The calc() subtracts the
   * container padding and grid gaps (phone: 2×16 px + 12 px gap → 50vw − 22px; tablet: 2×24 px + 2×12 px →
   * 33vw − 24px) so a 390 px phone at DPR 2 picks the 480 rendition instead of 640.
   */
  productGrid: "(min-width: 1024px) 280px, (min-width: 640px) calc(33vw - 24px), calc(50vw - 22px)",
  /** Product page main image. */
  productHero: "(min-width: 1024px) 560px, 100vw",
  /** Store cover band. */
  cover: "100vw",
  thumb: "80px",
} as const;

export type ImgLoading = { loading: "eager" | "lazy"; fetchPriority: "high" | "auto"; decoding: "async" | "sync" };

/** First above-the-fold image: eager + high priority (LCP). Everything else: lazy. */
export function loadingFor(index: number, aboveTheFoldCount = 1): ImgLoading {
  return index < aboveTheFoldCount
    ? { loading: "eager", fetchPriority: "high", decoding: "sync" }
    : { loading: "lazy", fetchPriority: "auto", decoding: "async" };
}

/** Props for a plain <img> (or our ResponsiveImage) from a stored image. Works for legacy rows with no metadata. */
export function imageProps(img: ImageLike, opts: { sizes: string; index?: number; aboveTheFold?: number; alt: string }) {
  const srcSet = buildSrcSet(img.renditions);
  const l = loadingFor(opts.index ?? 0, opts.aboveTheFold ?? 1);
  return {
    src: img.url,
    srcSet,
    sizes: srcSet ? opts.sizes : undefined,
    width: img.width ?? undefined,
    height: img.height ?? undefined,
    alt: opts.alt,
    ...l,
  };
}

/** Inline style for a blur-up / colour placeholder behind the image while it loads. */
export function placeholderStyle(img: ImageLike): Record<string, string> | undefined {
  if (img.placeholder) {
    return {
      backgroundImage: `url("${img.placeholder}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      ...(img.dominantColor ? { backgroundColor: img.dominantColor } : {}),
    };
  }
  return img.dominantColor ? { backgroundColor: img.dominantColor } : undefined;
}
