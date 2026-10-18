import { describe, expect, it } from "vitest";
import { GET } from "@/app/.well-known/security.txt/route";

describe("security.txt", () => {
  it("serves a contact and expiry as text/plain", async () => {
    const res = await GET();
    expect(res.headers.get("content-type")).toContain("text/plain");
    const t = await res.text();
    expect(t).toMatch(/^Contact: mailto:.+@.+/m);
    expect(t).toMatch(/^Expires: \d{4}-/m);
  });
});
