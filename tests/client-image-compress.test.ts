import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import {
  CLIENT_WEBP_QUALITY,
  MAX_CLIENT_EDGE,
  SKIP_BELOW_BYTES,
  needsCompression,
  pickSmaller,
  renamedFor,
  targetSize,
} from "@/lib/client-image-compress";

describe("client pre-compression size math", () => {
  it("scales the longest side to 2048 and keeps the aspect ratio", () => {
    expect(MAX_CLIENT_EDGE).toBe(2048);
    expect(CLIENT_WEBP_QUALITY).toBe(0.85);
    expect(targetSize(4000, 3000)).toEqual({ width: 2048, height: 1536, scale: 0.512 });
    expect(targetSize(3000, 4000)).toEqual({ width: 1536, height: 2048, scale: 0.512 });
    expect(targetSize(4032, 4032)).toMatchObject({ width: 2048, height: 2048 });
    expect(targetSize(12000, 10)).toMatchObject({ width: 2048, height: 2 });
    expect(targetSize(10, 12000)).toMatchObject({ width: 2, height: 2048 });
    expect(targetSize(3, 9000)).toMatchObject({ width: 1, height: 2048 });
  });
  it("never upscales and rejects invalid sizes", () => {
    expect(targetSize(2048, 1000)).toEqual({ width: 2048, height: 1000, scale: 1 });
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600, scale: 1 });
    expect(() => targetSize(0, 10)).toThrow();
    expect(() => targetSize(Number.NaN, 10)).toThrow();
  });
  it("only re-encodes photos that are too large in pixels or bytes", () => {
    expect(needsCompression({ width: 4000, height: 3000 }, 100_000)).toBe(true);
    expect(needsCompression({ width: 1200, height: 900 }, SKIP_BELOW_BYTES + 1)).toBe(true);
    expect(needsCompression({ width: 1200, height: 900 }, SKIP_BELOW_BYTES)).toBe(false);
    expect(needsCompression({ width: 2048, height: 2048 }, 1000)).toBe(false);
  });
  it("keeps the original when re-encoding does not help, and renames by type", () => {
    expect(pickSmaller({ size: 100 }, { size: 80 })).toEqual({ size: 80 });
    expect(pickSmaller({ size: 100 }, { size: 120 })).toEqual({ size: 100 });
    expect(pickSmaller({ size: 100 }, null)).toEqual({ size: 100 });
    expect(pickSmaller({ size: 100 }, { size: 0 })).toEqual({ size: 100 });
    expect(renamedFor("IMG_1234.JPG", "image/webp")).toBe("IMG_1234.webp");
    expect(renamedFor("photo.tar.png", "image/jpeg")).toBe("photo.tar.jpg");
    expect(renamedFor(".jpg", "image/webp")).toBe("photo.webp");
  });
  it("caps what the server has to decode at ~4.2 MP, whatever the camera", () => {
    // 2048² ≈ 4.2 MP — a 0.85 WebP of that is typically 0.2–0.6 MB, far under Vercel's ~4.5 MB body limit.
    const { width, height } = targetSize(8000, 6000);
    expect(width * height).toBeLessThanOrEqual(2048 * 2048);
  });
});

describe("public/ rasters", () => {
  it("no JPEG/PNG left in public/images (WebP only; PWA icons live in public/icons)", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
    const files = walk("public/images");
    expect(files.filter((f) => /\.(jpe?g|png|gif)$/i.test(f))).toEqual([]);
    expect(files.every((f) => f.endsWith(".webp"))).toBe(true);
  });
});
