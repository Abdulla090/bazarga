import { describe, expect, it } from "vitest";
import { ROBOTS_DISALLOW } from "@/lib/seo";

describe("robots", () => {
  it("keeps invite links out of search", () => {
    expect(ROBOTS_DISALLOW).toContain("/invite/");
  });
});
