import { describe, expect, it } from "vitest";
import { isPreviewRequest } from "@/lib/preview";

describe("theme studio preview marker", () => {
  it("only /s/<slug>?pv=1 counts", () => {
    expect(isPreviewRequest("/s/demo", new URLSearchParams("pv=1"))).toBe(true);
    expect(isPreviewRequest("/s/demo/p/x", new URLSearchParams("pv=1&q=a"))).toBe(true);
    expect(isPreviewRequest("/s/demo", new URLSearchParams(""))).toBe(false);
    expect(isPreviewRequest("/s/demo", new URLSearchParams("pv=atelier"))).toBe(false);
    expect(isPreviewRequest("/dashboard", new URLSearchParams("pv=1"))).toBe(false);
  });
});
