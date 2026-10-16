export type Testimonial = { id: string; quote: string; author: string; role: string | null; city: string | null; storeSlug: string | null };
export const TESTIMONIALS_LIMIT = 6;
/** Drops rows with a blank quote or author so nothing half-empty is ever rendered. */
export function cleanTestimonials(rows: Testimonial[]): Testimonial[] {
  return rows
    .map((r) => ({ ...r, quote: r.quote.trim(), author: r.author.trim() }))
    .filter((r) => r.quote.length > 0 && r.author.length > 0)
    .slice(0, TESTIMONIALS_LIMIT);
}
