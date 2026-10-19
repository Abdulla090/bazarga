import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cfg = readFileSync("next.config.ts", "utf8");

describe("static security headers", () => {
  it.each([
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Strict-Transport-Security",
    "Cross-Origin-Opener-Policy",
    "X-Permitted-Cross-Domain-Policies",
  ])("sets %s", (h) => {
    expect(cfg).toContain(`key: "${h}"`);
  });
  it("locks down powerful browser APIs and ad cohorts", () => {
    for (const f of ["usb=()", "serial=()", "bluetooth=()", "browsing-topics=()", "interest-cohort=()"]) expect(cfg).toContain(f);
  });
  it("hides x-powered-by", () => {
    expect(cfg).toContain("poweredByHeader: false");
  });
});
