import { describe, it, expect, vi } from "vitest";

vi.mock("@/server/db", () => ({ db: () => ({}) }));
vi.mock("@/server/services/short-links", () => ({
  resolveShortCode: async (_d: unknown, c: string) => (c === "ok" ? { slug: "s", productId: "p1" } : null),
}));

import { GET } from "@/app/p/[code]/route";

describe("short link route caching", () => {
  it("caches found redirects at the edge, never misses", async () => {
    const hit = await GET(new Request("https://x.test/p/ok?src=tiktok"), { params: Promise.resolve({ code: "ok" }) });
    expect(hit.status).toBe(307);
    expect(hit.headers.get("Cache-Control")).toContain("s-maxage=60");
    const miss = await GET(new Request("https://x.test/p/no"), { params: Promise.resolve({ code: "no" }) });
    expect(miss.headers.get("Cache-Control")).toBe("no-store");
  });
});
