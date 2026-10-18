import { describe, expect, it } from "vitest";
import { autoCropBox, backgroundMask, cropRgba, edgeColor, enhance, runStudio, whitenBackground, type Rgba } from "@/lib/studio/process";
import { removeBackground, removeBgOn } from "@/server/studio/remove-bg";
import { COMPARE, PLANS, studioEditsLimit } from "@/lib/plans";

/** 40×30 light-grey backdrop (230) with a dark 10×8 "product" at (15,10) and a white dot inside it. */
function photo(): Rgba {
  const w = 40, h = 30, data = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const x = p % w, y = Math.floor(p / w);
    const inside = x >= 15 && x < 25 && y >= 10 && y < 18;
    const v = inside ? (x === 20 && y === 14 ? 232 : 40) : 230 + ((x * 7 + y * 3) % 5);
    data.set([v, v, v, 255], p * 4);
  }
  return { data, width: w, height: h };
}
const px = (img: Rgba, x: number, y: number) => Array.from(img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 3));

describe("Product Studio local cleanup (SF9)", () => {
  it("finds the backdrop colour and masks only the connected background", () => {
    const img = photo();
    expect(edgeColor(img)[0]).toBeGreaterThanOrEqual(230);
    const m = backgroundMask(img);
    expect(m[0]).toBe(1);
    expect(m[12 * 40 + 18]).toBe(0); // product
    expect(m[14 * 40 + 20]).toBe(0); // light detail inside the product is not "background"
  });
  it("whitens the background but keeps the product", () => {
    const img = photo();
    whitenBackground(img, backgroundMask(img));
    expect(px(img, 2, 2)).toEqual([255, 255, 255]);
    expect(px(img, 18, 12)).toEqual([40, 40, 40]);
  });
  it("auto-crops around the product with padding, inside the image", () => {
    const img = photo();
    const box = autoCropBox(backgroundMask(img), img.width, img.height, 0.1);
    expect(box).toEqual({ x: 14, y: 9, w: 12, h: 10 });
    const c = cropRgba(img, box);
    expect([c.width, c.height]).toEqual([12, 10]);
    expect(px(c, 4, 3)).toEqual([40, 40, 40]);
    const all = new Uint8Array(40 * 30).fill(1);
    expect(autoCropBox(all, 40, 30)).toEqual({ x: 0, y: 0, w: 40, h: 30 });
  });
  it("brightness/contrast move mid-tones and clamp", () => {
    const img: Rgba = { data: new Uint8ClampedArray([100, 100, 100, 255, 250, 250, 250, 255]), width: 2, height: 1 };
    enhance(img, 10, 20);
    expect(img.data[0]).toBeGreaterThan(100);
    expect(img.data[4]).toBe(255);
    expect(img.data[3]).toBe(255);
  });
  it("runStudio returns a new image and leaves the input alone", () => {
    const img = photo();
    const copy = new Uint8ClampedArray(img.data);
    const out = runStudio(img, { whiten: true, crop: true, enhance: false, brightness: 0, contrast: 0 });
    expect(img.data).toEqual(copy);
    expect(out.width).toBeLessThan(img.width);
    expect(px(out, 0, 0)).toEqual([255, 255, 255]);
  });
});

describe("Product Studio plans + AI provider", () => {
  it("quota 0 / 10 / 100 / 100 and no Soon tag", () => {
    expect(["free", "pro", "business", "max"].map((p) => studioEditsLimit(p as "free"))).toEqual([0, 10, 100, 100]);
    expect(COMPARE.find((r) => r.key === "studio")).toMatchObject({ free: false, pro: 10, business: 100, max: 100 });
    for (const p of PLANS) for (const f of p.features) if (f.key === "studio") expect(f.soon).toBeFalsy();
  });
  it("remove.bg is optional and failures return null", async () => {
    expect(removeBgOn(undefined)).toBe(false);
    expect(removeBgOn("k")).toBe(true);
    let seen: Headers | undefined;
    const ok = (async (_u: string, init: RequestInit) => { seen = new Headers(init.headers); return new Response(new Blob(["png"]), { status: 200 }); }) as unknown as typeof fetch;
    expect(await removeBackground(new Blob(["x"]), "key1", ok)).not.toBeNull();
    expect(seen?.get("X-Api-Key")).toBe("key1");
    const bad = (async () => new Response("{}", { status: 402 })) as unknown as typeof fetch;
    expect(await removeBackground(new Blob(["x"]), "k", bad)).toBeNull();
  });
});
