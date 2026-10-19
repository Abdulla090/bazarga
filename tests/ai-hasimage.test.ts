import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("catalogContext has-photo check", () => {
  it("uses a table-qualified exists subquery (not a self-compare)", () => {
    const src = readFileSync("src/server/actions/ai.ts", "utf8");
    expect(src).toContain('pi.product_id = "products"."id"');
    expect(src).not.toContain("${productImages.productId} = ${products.id}");
  });
});
