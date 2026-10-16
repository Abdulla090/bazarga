import "server-only";
import { cacheLife } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { testimonials } from "../db/schema";
import { cleanTestimonials, TESTIMONIALS_LIMIT, type Testimonial } from "@/lib/testimonials";

/** Approved quotes only; a DB hiccup returns [] so the section simply stays hidden. */
export async function getTestimonials(): Promise<Testimonial[]> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  try {
    const rows = await db()
      .select({ id: testimonials.id, quote: testimonials.quote, author: testimonials.author, role: testimonials.role, city: testimonials.city, storeSlug: testimonials.storeSlug })
      .from(testimonials)
      .where(eq(testimonials.approved, true))
      .orderBy(desc(testimonials.createdAt))
      .limit(TESTIMONIALS_LIMIT);
    return cleanTestimonials(rows);
  } catch {
    return [];
  }
}
