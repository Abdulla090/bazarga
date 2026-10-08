/**
 * Privacy-friendly view counter for seller analytics: a same-origin 1×1 image, no JavaScript, no cookies.
 * Server component; see src/app/api/v/[slug]/route.ts and src/lib/analytics.ts.
 */
export function ViewPixel({ slug, productId }: { slug: string; productId?: string }) {
  const src = `/api/v/${slug}${productId ? `?p=${productId}` : ""}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a counting pixel, not content
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={1}
      height={1}
      decoding="async"
      fetchPriority="low"
      referrerPolicy="no-referrer"
      className="pointer-events-none fixed bottom-0 start-0 h-px w-px opacity-0"
      data-testid="view-pixel"
    />
  );
}
