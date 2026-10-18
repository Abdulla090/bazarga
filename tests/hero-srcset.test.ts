import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import seedImages from "../scripts/seed-images.json";
import { buildSrcSet, imageProps, SEED_RENDITION_WIDTHS, srcSetRenditions } from "../src/lib/responsive-image";
import { RENDITION_WIDTHS } from "../src/server/storage/pipeline";

const seedDir = path.join(__dirname, "..", "public", "images", "seed");
const onDisk = new Set(readdirSync(seedDir));
const r = (url: string, width: number, height = Math.round(width * 0.558)) => ({ url, width, height });

/** Rows seeded before the Oct 2026 lean re-encode still store the 1376 w hero (its source width). */
const staleHero = [320, 480, 640, 1024, 1376].map((w) => r(`/images/seed/hero-${w}.webp`, w));

describe("hero srcset only lists renditions that exist", () => {
  it("seed widths mirror the upload pipeline widths", () => {
    expect([...SEED_RENDITION_WIDTHS]).toEqual([...RENDITION_WIDTHS]);
  });

  it("clamps the stale 1376 w seed hero to the real 1280 file", () => {
    const set = buildSrcSet(staleHero)!;
    expect(set).not.toContain("1376");
    expect(set).toBe(
      "/images/seed/hero-320.webp 320w, /images/seed/hero-480.webp 480w, /images/seed/hero-640.webp 640w, /images/seed/hero-1024.webp 1024w, /images/seed/hero-1280.webp 1280w",
    );
    for (const e of srcSetRenditions(staleHero)) expect(onDisk.has(path.basename(e.url))).toBe(true);
  });

  it("dedupes a clamp that collides with the real top file, keeps a small source's own top width", () => {
    const list = [r("/images/seed/hero-1280.webp", 1280), r("/images/seed/hero-1600.webp", 1600)];
    expect(buildSrcSet(list)).toBe("/images/seed/hero-1280.webp 1280w");
    expect(buildSrcSet([r("/images/seed/crop-320.webp", 320), r("/images/seed/crop-400.webp", 400)])).toBe(
      "/images/seed/crop-320.webp 320w, /images/seed/crop-400.webp 400w",
    );
  });

  it("keeps pipeline uploads as stored (source-width tops and legacy 1600 files are real)", () => {
    const base = "https://cdn.example/stores/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222";
    const list = [r(`${base}-1200.webp`, 1200), r(`${base}-320.webp`, 320), r(`${base}-1600.webp`, 1600)];
    expect(buildSrcSet(list)).toBe(`${base}-320.webp 320w, ${base}-1200.webp 1200w, ${base}-1600.webp 1600w`);
  });

  it("drops malformed entries and returns undefined when nothing is left", () => {
    expect(buildSrcSet([r("", 320), r("/x-0.webp", 0)])).toBeUndefined();
    expect(buildSrcSet(null)).toBeUndefined();
    expect(imageProps({ url: "/images/seed/hero-1024.webp", renditions: staleHero }, { sizes: "100vw", alt: "" }).srcSet).not.toContain("1376");
  });

  it("every rendition in the seed manifest exists on disk at a generated width", () => {
    for (const [name, img] of Object.entries(seedImages as Record<string, { renditions: { url: string; width: number }[] }>)) {
      for (const e of img.renditions) {
        expect(onDisk.has(path.basename(e.url)), `${name} ${e.url}`).toBe(true);
        expect(e.width).toBeLessThanOrEqual(Math.max(...SEED_RENDITION_WIDTHS));
      }
      expect(buildSrcSet(img.renditions as never)).toBe(img.renditions.map((e) => `${e.url} ${e.width}w`).join(", "));
    }
  });
});
