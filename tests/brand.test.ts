import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const OLD = [/my market/i, /فرۆشگاکەم/];
const files = ["messages/ku.json", "messages/ar.json", "messages/en.json", "messages/kmr.json", "public/offline.html", "public/sw.js", "src/app/layout.tsx", "src/app/manifest.ts", "src/components/Logo.tsx"];

describe("brand: Reelcart", () => {
  it.each(files)("%s has no leftover old app name", (f) => {
    const text = readFileSync(f, "utf8");
    for (const re of OLD) expect(text).not.toMatch(re);
  });
  it("uses بازارگە in Kurdish/Arabic and Reelcart in English", () => {
    const ku = JSON.parse(readFileSync("messages/ku.json", "utf8"));
    const ar = JSON.parse(readFileSync("messages/ar.json", "utf8"));
    const en = JSON.parse(readFileSync("messages/en.json", "utf8"));
    expect(ku.common.appName).toBe("بازارگە");
    expect(ar.common.appName).toBe("بازارگە");
    expect(en.common.appName).toBe("Reelcart");
    expect(en.store.poweredBy).toBe("Made with Reelcart");
    // No Latin "Bazarga" left in any locale (local script بازارگە stays in ku/ar).
    for (const l of ["en", "ku", "ar", "kmr"]) {
      const vals: string[] = [];
      const walk = (o: unknown) => { if (typeof o === "string") vals.push(o); else if (o && typeof o === "object") Object.values(o).forEach(walk); };
      walk(JSON.parse(readFileSync(`messages/${l}.json`, "utf8")));
      expect(vals.filter((v) => /bazarga/i.test(v))).toEqual([]);
    }
  });
  it("keeps the taglines", () => {
    expect(JSON.parse(readFileSync("messages/en.json", "utf8")).common.tagline).toBe("Your store, in your language.");
    expect(JSON.parse(readFileSync("messages/ku.json", "utf8")).common.tagline).toBe("دوکانەکەت، بە زمانی خۆت.");
    expect(JSON.parse(readFileSync("messages/ar.json", "utf8")).common.tagline).toBe("متجرك، بلغتك.");
  });
});
