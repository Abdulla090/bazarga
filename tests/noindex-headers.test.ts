import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("private areas send X-Robots-Tag noindex", () => {
  const src = readFileSync("next.config.ts", "utf8");
  it.each(["/dashboard/:path*", "/admin/:path*", "/onboarding/:path*", "/api/:path*"])("%s", (p) => {
    expect(src).toContain(`"${p}"`);
  });
  it("sets noindex, nofollow", () => expect(src).toContain('"noindex, nofollow"'));
});
