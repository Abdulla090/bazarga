import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("storefront layout", () => {
  it("mounts PreviewBridge only inside an iframe", () => {
    const src = readFileSync("src/app/s/[slug]/layout.tsx", "utf8");
    expect(src).toContain('sec-fetch-dest');
    expect(src).toContain("inIframe ? <PreviewBridge />");
  });
});
