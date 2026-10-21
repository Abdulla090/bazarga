import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const files = [
  "src/app/s/[slug]/loading.tsx",
  "src/app/s/[slug]/cart/loading.tsx",
  "src/app/s/[slug]/order/loading.tsx",
  "src/app/s/[slug]/order/[publicId]/loading.tsx",
  "src/app/s/[slug]/p/[productId]/loading.tsx",
  "src/app/s/[slug]/track/loading.tsx",
];
describe("storefront skeletons are labelled", () => {
  it.each(files)("%s renders SrLoading", (f) => {
    expect(readFileSync(f, "utf8")).toContain("<SrLoading />");
  });
});
