import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("manifest shortcuts", () => {
  it("offers Orders and Products shortcuts inside scope", () => {
    const m = manifest();
    const urls = (m.shortcuts ?? []).map((s) => s.url);
    expect(urls).toEqual(["/dashboard/orders?source=pwa", "/dashboard/products?source=pwa"]);
    for (const s of m.shortcuts ?? []) expect(s.url.startsWith(m.scope ?? "/")).toBe(true);
  });
});
