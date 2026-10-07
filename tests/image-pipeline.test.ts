import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { crc32 } from "node:zlib";
import {
  MAX_INPUT_PIXELS,
  RENDITION_KEY_RE,
  RENDITION_WIDTHS,
  pickDefaultRendition,
  processImage,
  renditionKey,
  renditionWidths,
  storeImage,
  type ImageSink,
} from "@/server/storage/pipeline";
import { buildSrcSet, imageProps, loadingFor, placeholderStyle } from "@/lib/responsive-image";
import { productImageSchema } from "@/lib/validation";

/** A JPEG with EXIF incl. GPS + orientation 6 (rotate 90° CW), 2400×1200 stored → 1200×2400 displayed. */
async function jpegWithGps(width = 2400, height = 1200, orientation = 6) {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } } })
    .jpeg({ quality: 90 })
    .withMetadata({ orientation })
    .withExif({
      IFD0: { Make: "TestPhone", Model: "X" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "36/1 11/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "44/1 0/1 0/1" },
    })
    .toBuffer();
}

/** 1×1 PNG whose IHDR is rewritten to claim side×side pixels (CRC fixed) — a header-only decompression bomb. */
function pngClaiming(side: number): Uint8Array {
  const base = Buffer.from(
    "89504E470D0A1A0A0000000D4948445200000001000000010806000000" + "1F15C489" + "0000000D49444154789C6360000002000154A24F5D0000000049454E44AE426082",
    "hex",
  );
  const out = Buffer.from(base);
  out.writeUInt32BE(side, 16);
  out.writeUInt32BE(side, 20);
  out.writeUInt32BE(crc32(out.subarray(12, 29)), 29);
  return out;
}

class MemorySink implements ImageSink {
  files = new Map<string, { body: Uint8Array; type: string }>();
  async put(key: string, body: Uint8Array, contentType: string) {
    this.files.set(key, { body, type: contentType });
    return { key, url: `https://cdn.example/${key}` };
  }
}

const STORE = "11111111-2222-4333-8444-555555555555";

describe("renditionWidths", () => {
  it("never upscales and keeps the source width as the top size", () => {
    expect(renditionWidths(4000)).toEqual([...RENDITION_WIDTHS]);
    expect(renditionWidths(1600)).toEqual([320, 640, 1024, 1600]);
    expect(renditionWidths(1200)).toEqual([320, 640, 1024, 1200]);
    expect(renditionWidths(500)).toEqual([320, 500]);
    expect(renditionWidths(200)).toEqual([200]);
    expect(() => renditionWidths(0)).toThrow();
  });
  it("defaults to the ≥1024 rendition, else the largest", () => {
    expect(pickDefaultRendition([{ width: 320 }, { width: 640 }, { width: 1024 }, { width: 1600 }]).width).toBe(1024);
    expect(pickDefaultRendition([{ width: 320 }, { width: 500 }]).width).toBe(500);
  });
});

describe("processImage", () => {
  it("fixture really carries GPS + orientation", async () => {
    const meta = await sharp(await jpegWithGps()).metadata();
    expect(meta.exif).toBeDefined();
    expect(meta.exif!.includes(Buffer.from("TestPhone"))).toBe(true);
    expect(meta.orientation).toBe(6);
    // GPS IFD makes the EXIF block bigger than the same image without it
    const noGps = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExif({ IFD0: { Make: "TestPhone", Model: "X" } })
      .toBuffer();
    expect(meta.exif!.length).toBeGreaterThan((await sharp(noGps).metadata()).exif!.length);
  });

  it("applies orientation, emits WebP sizes, strips EXIF/GPS/XMP/ICC", async () => {
    const out = await processImage(await jpegWithGps(), { maxMb: 5 });
    // 2400×1200 rotated 90° → 1200×2400 portrait
    expect(out.renditions.map((r) => r.width)).toEqual([320, 640, 1024, 1200]);
    expect(out.width).toBe(1200);
    expect(out.height).toBe(2400);
    for (const r of out.renditions) {
      const m = await sharp(r.data).metadata();
      expect(m.format).toBe("webp");
      expect(m.width).toBe(r.width);
      expect(m.height).toBe(r.width * 2);
      expect(m.exif).toBeUndefined();
      expect(m.xmp).toBeUndefined();
      expect(m.iptc).toBeUndefined();
      expect(m.icc).toBeUndefined();
      expect(m.orientation).toBeUndefined();
      expect(r.data.includes(Buffer.from("TestPhone"))).toBe(false);
    }
    // smaller sizes are actually smaller
    const bytes = out.renditions.map((r) => r.data.byteLength);
    expect([...bytes].sort((a, b) => a - b)).toEqual(bytes);
  });

  it("produces a tiny WebP placeholder and the dominant colour", async () => {
    const out = await processImage(await jpegWithGps(800, 800, 1), { maxMb: 5 });
    expect(out.placeholder).toMatch(/^data:image\/webp;base64,/);
    expect(out.placeholder.length).toBeLessThan(1000);
    const ph = await sharp(Buffer.from(out.placeholder.split(",")[1]!, "base64")).metadata();
    expect(ph.width).toBe(16);
    expect(out.dominantColor).toMatch(/^#[0-9a-f]{6}$/);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(out.dominantColor.slice(i, i + 2), 16)) as [number, number, number];
    expect(r).toBeGreaterThan(150);
    expect(g).toBeLessThan(100);
    expect(b).toBeLessThan(100);
  });

  it("handles PNG with alpha and small images without upscaling", async () => {
    const png = await sharp({ create: { width: 300, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.5 } } }).png().toBuffer();
    const out = await processImage(png, { maxMb: 5 });
    expect(out.renditions.map((r) => [r.width, r.height])).toEqual([[300, 200]]);
    expect((await sharp(out.renditions[0]!.data).metadata()).hasAlpha).toBe(true);
  });

  it("rejects non-images, oversize files and decompression bombs", async () => {
    await expect(processImage(new TextEncoder().encode("<svg onload=alert(1)>"), { maxMb: 5 })).rejects.toMatchObject({
      message: "unsupported_image_type",
    });
    const big = await jpegWithGps(1000, 1000, 1);
    await expect(processImage(big, { maxMb: 0.00001 })).rejects.toMatchObject({ message: "file_too_large" });
    // A tiny PNG whose header claims more pixels than the cap (sharp checks before decoding).
    const bomb = pngClaiming(Math.ceil(Math.sqrt(MAX_INPUT_PIXELS)) + 10);
    await expect(processImage(bomb, { maxMb: 50 })).rejects.toMatchObject({ message: "image_too_large" });
    // Truncated JPEG: magic bytes OK, body garbage.
    const truncated = new Uint8Array([...big.subarray(0, 200)]);
    await expect(processImage(truncated, { maxMb: 5 })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("storeImage (through the abstract storage sink)", () => {
  it("writes every rendition under the store prefix and returns metadata the product form accepts", async () => {
    const sink = new MemorySink();
    const stored = await storeImage(sink, STORE, await jpegWithGps(2000, 1500, 1), { maxMb: 5 });
    expect(stored.renditions.map((r) => r.width)).toEqual([320, 640, 1024, 1600]);
    expect([...sink.files.keys()].every((k) => RENDITION_KEY_RE.test(k) && k.startsWith(`stores/${STORE}/`))).toBe(true);
    expect([...sink.files.values()].every((f) => f.type === "image/webp")).toBe(true);
    expect(stored.url).toMatch(/-1024\.webp$/);
    expect(stored.storageKey).toMatch(/-1024\.webp$/);
    expect({ w: stored.width, h: stored.height }).toEqual({ w: 1600, h: 1200 });
    expect(stored.renditions.every((r) => r.bytes > 0 && r.height === Math.round((r.width * 3) / 4))).toBe(true);
    expect(productImageSchema.safeParse(stored).success).toBe(true);
    expect(renditionKey(STORE, STORE, 320)).toBe(`stores/${STORE}/${STORE}-320.webp`);
  });
});

describe("responsive <img> helpers", () => {
  const img = {
    url: "/a-1024.webp",
    width: 1600,
    height: 1200,
    placeholder: "data:image/webp;base64,AAAA",
    dominantColor: "#aa0000",
    renditions: [
      { width: 1024, height: 768, url: "/a-1024.webp" },
      { width: 320, height: 240, url: "/a-320.webp" },
    ],
  };
  it("builds an ascending srcset", () => {
    expect(buildSrcSet(img.renditions)).toBe("/a-320.webp 320w, /a-1024.webp 1024w");
    expect(buildSrcSet([])).toBeUndefined();
  });
  it("first above-the-fold image is eager/high priority, the rest lazy", () => {
    expect(loadingFor(0)).toEqual({ loading: "eager", fetchPriority: "high", decoding: "sync" });
    expect(loadingFor(1)).toMatchObject({ loading: "lazy", fetchPriority: "auto" });
    expect(loadingFor(1, 2)).toMatchObject({ loading: "eager" });
    expect(loadingFor(0, 0)).toMatchObject({ loading: "lazy" });
  });
  it("legacy rows without metadata degrade to a plain src", () => {
    const p = imageProps({ url: "/images/product-honey.jpg" }, { sizes: "50vw", alt: "honey", index: 3 });
    expect(p).toMatchObject({ src: "/images/product-honey.jpg", srcSet: undefined, sizes: undefined, width: undefined, loading: "lazy" });
    expect(placeholderStyle({ url: "/x" })).toBeUndefined();
  });
  it("full rows get srcset, sizes, intrinsic size and a placeholder background", () => {
    const p = imageProps(img, { sizes: "50vw", alt: "x" });
    expect(p).toMatchObject({ srcSet: expect.stringContaining("320w"), sizes: "50vw", width: 1600, height: 1200, loading: "eager" });
    expect(placeholderStyle(img)).toMatchObject({ backgroundImage: 'url("data:image/webp;base64,AAAA")', backgroundColor: "#aa0000" });
  });
  it("product form schema rejects scriptable placeholders and foreign schemes", () => {
    expect(productImageSchema.safeParse({ ...img, placeholder: "javascript:alert(1)", renditions: [] }).success).toBe(false);
    expect(productImageSchema.safeParse({ url: "http://evil/x.webp", renditions: [] }).success).toBe(false);
    expect(productImageSchema.safeParse({ url: "/x.webp", placeholder: 'data:image/webp;base64,A")', renditions: [] }).success).toBe(false);
  });
});
