import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { smallRenditionUrl } from "@/lib/responsive-image";

const S = "a7e34a6e-8a05-41ca-9022-6438c567c2d8";
const I = "d1029c3d-bf68-4235-83a5-be918fa0a342";

describe("store header logo uses the smallest rendition", () => {
  it("swaps a pipeline -1024/-640/-480/-1280 key for -320", () => {
    for (const w of [480, 640, 1024, 1280]) {
      expect(smallRenditionUrl(`https://x.supabase.co/storage/v1/object/public/uploads/stores/${S}/${I}-${w}.webp`)).toBe(
        `https://x.supabase.co/storage/v1/object/public/uploads/stores/${S}/${I}-320.webp`,
      );
    }
    expect(smallRenditionUrl(`/api/files/stores/${S}/${I}-1024.webp`)).toBe(`/api/files/stores/${S}/${I}-320.webp`);
  });
  it("leaves seed, legacy, odd-width and external URLs alone", () => {
    for (const u of ["/images/seed/logo-1024.webp", `https://x/stores/${S}/${I}-900.webp`, `https://x/stores/${S}/${I}-320.webp`, "https://cdn.example.com/logo.png"]) {
      expect(smallRenditionUrl(u)).toBe(u);
    }
  });
  it("the header mark is low priority so React never preloads it ahead of the LCP photo", () => {
    const src = readFileSync("src/components/store/chrome.tsx", "utf8");
    expect(src).toMatch(/smallRenditionUrl\(store\.logoUrl\)[^>]*fetchPriority="low"/);
  });
});
