import { describe, expect, it } from "vitest";
import { buildSecurityTxt } from "../src/app/.well-known/security.txt/route";

describe("security.txt", () => {
  it("has contact, expiry and canonical", () => {
    const t = buildSecurityTxt("a@b.co", "https://x.app");
    expect(t).toContain("Contact: mailto:a@b.co");
    expect(t).toMatch(/Expires: \d{4}-/);
    expect(t).toContain("Canonical: https://x.app/.well-known/security.txt");
  });
});
