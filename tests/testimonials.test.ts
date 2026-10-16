import { describe, expect, it } from "vitest";
import { cleanTestimonials, TESTIMONIALS_LIMIT } from "@/lib/testimonials";

const row = (o: Partial<{ quote: string; author: string }> = {}) => ({ id: "1", quote: "Great", author: "Sara", role: null, city: null, storeSlug: null, ...o });
describe("cleanTestimonials", () => {
  it("drops blank quotes/authors and trims", () => {
    const out = cleanTestimonials([row({ quote: "  " }), row({ author: "" }), row({ quote: " ok ", author: " A " })]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ quote: "ok", author: "A" });
  });
  it("caps the list and returns [] for none", () => {
    expect(cleanTestimonials(Array.from({ length: 20 }, () => row()))).toHaveLength(TESTIMONIALS_LIMIT);
    expect(cleanTestimonials([])).toEqual([]);
  });
});
