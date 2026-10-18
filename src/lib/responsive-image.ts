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

/**
 * Widths that exist on disk for the pre-built seed images (public/images/seed/<name>-<w>.webp). Mirrors the upload
 * pipeline's RENDITION_WIDTHS (src/server/storage/pipeline.ts; a test pins the two together) — kept here because this
 * module must stay free of Node/sharp imports.
 */
export const SEED_RENDITION_WIDTHS = [320, 480, 640, 1024, 1280] as const;
const SEED_TAIL = /^(.*\/images\/seed\/[a-z0-9-]+?)-(\d{2,5})\.webp$/;

/**
 * Renditions that are safe to list in a srcset, ascending and one per width. A stored rendition list can outlive the
 * files it names: the Oct 2026 lean re-encode replaced the seed hero's 1376 w top size (its source width) with 1280,
 * but rows seeded earlier still list `hero-1376.webp`, which 404s — and a phone at DPR ≈ 2.6 picks exactly that entry.
 * Seed entries wider than the largest generated width are clamped to it (the seed build, like the pipeline, keeps a
 * smaller source's own width as its top size but never emits anything above the top target); entries with a non-positive/non-integer width or no URL are dropped for any image. Pipeline uploads keep
 * whatever widths they store (legacy 1600 w files are real).
 */
export function srcSetRenditions<T extends RenditionLike>(renditions: readonly T[] | null | undefined): T[] {
  if (!renditions?.length) return [];
  const seedMax: number = SEED_RENDITION_WIDTHS[SEED_RENDITION_WIDTHS.length - 1]!;
  const out = new Map<number, T>();
  for (const r of [...renditions].sort((a, b) => a.width - b.width)) {
    if (!r?.url || !Number.isInteger(r.width) || r.width <= 0) continue;
    let entry = r;
    const seed = SEED_TAIL.exec(r.url);
    if (seed && r.width > seedMax) {
      // The seed build (like the pipeline) never emits a file wider than its top target: point at that one.
      entry = { ...r, width: seedMax, height: Math.round((r.height * seedMax) / r.width), url: `${seed[1]}-${seedMax}.webp` };
    }
    if (!out.has(entry.width)) out.set(entry.width, entry);
  }
  return [...out.values()].sort((a, b) => a.width - b.width);
}

export function buildSrcSet(renditions: readonly RenditionLike[] | null | undefined): string | undefined {
  const list = srcSetRenditions(renditions);
  if (!list.length) return undefined;
  return list.map((r) => `${r.url} ${r.width}w`).join(", ");
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
  productHero: "(min-width: 1024px) 560px, (min-width: 768px) 50vw, 100vw",
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

/**
 * Smallest pipeline rendition for a tiny avatar (store logo in the header, ~28–40 px). Pipeline keys end in
 * `-<width>.webp` and an upload always stores every RENDITION width below its top one, so a `-1024.webp` logo also
 * exists as `-320.webp` (30× fewer bytes). Anything else (seed images, legacy or external URLs) is returned as is.
 */
const PIPELINE_TAIL = /(\/stores\/[0-9a-f-]{36}\/[0-9a-f-]{36})-(\d{2,5})\.webp$/;
const PIPELINE_WIDTHS = new Set([480, 640, 1024, 1280]);
export function smallRenditionUrl(url: string): string {
  const m = PIPELINE_TAIL.exec(url);
  if (!m || !PIPELINE_WIDTHS.has(Number(m[2]))) return url;
  return url.slice(0, m.index) + `${m[1]}-320.webp`;
}
