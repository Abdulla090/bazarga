import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  displayUrl,
  escapeMarkup,
  qrMatrix,
  qrPath,
  qrSvg,
  shareFileName,
  storeUrl,
  storyLocale,
  STORY_SIZE,
  waShareLink,
} from "@/lib/share-kit";
import { imageSourceFor } from "@/server/share/assets";
import { renderStoryPng, type StoryInput } from "@/server/share/story";
import { resolveTheme } from "@/lib/theme";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const IMG = "33333333-3333-4333-8333-333333333333";

describe("share kit links", () => {
  it("store URL matches the dashboard link shape and trims trailing slashes", () => {
    expect(storeUrl("https://mymarket.app", "hawler-bazaar")).toBe("https://mymarket.app/s/hawler-bazaar");
    expect(storeUrl("https://mymarket.app/", "x")).toBe("https://mymarket.app/s/x");
    expect(displayUrl("https://mymarket.app/s/x")).toBe("mymarket.app/s/x");
    expect(displayUrl("http://localhost:3000/s/x/")).toBe("localhost:3000/s/x");
  });
  it("WhatsApp share link has no recipient and encodes RTL text + newlines", () => {
    const l = waShareLink("🛍️ داوا بکە\nhttps://mymarket.app/s/x");
    expect(l.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(l.slice("https://wa.me/?text=".length))).toBe("🛍️ داوا بکە\nhttps://mymarket.app/s/x");
  });
  it("story language: a known lang wins, anything else → the store's language", () => {
    expect(storyLocale("ar", "ku")).toBe("ar");
    expect(storyLocale("kmr", "en")).toBe("kmr");
    expect(storyLocale("fr", "ku")).toBe("ku");
    expect(storyLocale(null, "en")).toBe("en");
    expect(storyLocale("../../etc", "ku")).toBe("ku");
  });
  it("download names are safe", () => {
    expect(shareFileName("hawler-bazaar", "story", "png", "ku")).toBe("hawler-bazaar-story-ku.png");
    expect(shareFileName("hawler-bazaar", "qr", "svg")).toBe("hawler-bazaar-qr.svg");
    expect(shareFileName('a"b/../c', "qr", "png")).toBe("abc-qr.png");
    expect(shareFileName("", "qr", "png")).toBe("store-qr.png");
  });
  it("Pango markup is escaped", () => {
    expect(escapeMarkup(`<b>Tom & "Jerry's"</b>`)).toBe("&lt;b&gt;Tom &amp; &quot;Jerry&#39;s&quot;&lt;/b&gt;");
  });
});

describe("QR code", () => {
  const url = "https://mymarket.app/s/hawler-bazaar";
  it("is a valid square matrix with the three finder patterns", () => {
    const m = qrMatrix(url);
    expect(m.size).toBeGreaterThanOrEqual(21);
    expect((m.size - 17) % 4).toBe(0); // version n → 17 + 4n modules
    expect(m.data).toHaveLength(m.size);
    const finder = (x0: number, y0: number) => {
      for (let i = 0; i < 7; i++) {
        // outer ring dark, ring inside it light, 3×3 core dark
        expect(m.data[y0]![x0 + i]).toBe(true);
        expect(m.data[y0 + 6]![x0 + i]).toBe(true);
        expect(m.data[y0 + i]![x0]).toBe(true);
        expect(m.data[y0 + i]![x0 + 6]).toBe(true);
      }
      expect(m.data[y0 + 1]![x0 + 1]).toBe(false);
      expect(m.data[y0 + 3]![x0 + 3]).toBe(true);
    };
    finder(0, 0);
    finder(m.size - 7, 0);
    finder(0, m.size - 7);
  });
  it("is deterministic and depends on the URL", () => {
    expect(qrPath(qrMatrix(url))).toBe(qrPath(qrMatrix(url)));
    expect(qrPath(qrMatrix(url))).not.toBe(qrPath(qrMatrix(`${url}x`)));
  });
  it("path merges horizontal runs and applies the offset", () => {
    const m = { size: 3, data: [[true, true, false], [false, false, false], [false, true, true]] };
    expect(qrPath(m)).toBe("M0 0h2v1h-2zM1 2h2v1h-2z");
    expect(qrPath(m, 4)).toBe("M4 4h2v1h-2zM5 6h2v1h-2z");
  });
  it("SVG has a quiet zone, safe colours only, and rasterises with sharp", async () => {
    const svg = qrSvg(url, { fg: "#123456", bg: "red\" onload=\"x" });
    const n = qrMatrix(url).size + 8;
    expect(svg).toContain(`viewBox="0 0 ${n} ${n}"`);
    expect(svg).toContain('fill="#123456"');
    expect(svg).toContain('fill="#ffffff"'); // invalid bg ignored
    expect(svg).not.toContain("onload");
    const meta = await sharp(Buffer.from(qrSvg(url, { px: 600 }))).metadata();
    expect(meta).toMatchObject({ width: 600, height: 600 });
  });
});

describe("store image sources (no SSRF, no cross-tenant reads)", () => {
  it("local uploads: only this store's keys", () => {
    expect(imageSourceFor(`/api/files/stores/${A}/${IMG}-320.webp`, A)).toEqual({ kind: "local", key: `stores/${A}/${IMG}-320.webp` });
    expect(imageSourceFor(`/api/files/stores/${B}/${IMG}.png`, A)).toBeNull();
    expect(imageSourceFor(`/api/files/stores/${A}/../${B}/${IMG}.png`, A)).toBeNull();
    expect(imageSourceFor(`/api/files/stores/${A}/x.svg`, A)).toBeNull();
  });
  it("S3: only under the configured public URL and this store's prefix", () => {
    const pub = "https://cdn.example.com/bucket";
    expect(imageSourceFor(`${pub}/stores/${A}/${IMG}.webp`, A, pub)).toEqual({ kind: "remote", url: `${pub}/stores/${A}/${IMG}.webp` });
    expect(imageSourceFor(`${pub}/stores/${B}/${IMG}.webp`, A, pub)).toBeNull();
    expect(imageSourceFor(`https://evil.example/stores/${A}/${IMG}.webp`, A, pub)).toBeNull();
    expect(imageSourceFor("http://169.254.169.254/latest/meta-data", A, pub)).toBeNull();
  });
  it("bundled /images assets are allowed; traversal and empty are not", () => {
    expect(imageSourceFor("/images/product-honey.jpg", A)).toEqual({ kind: "public", file: "images/product-honey.jpg" });
    expect(imageSourceFor("/images/../../.env.png", A)).toBeNull();
    expect(imageSourceFor(null, A)).toBeNull();
    expect(imageSourceFor("", A)).toBeNull();
  });
});

describe("story image", () => {
  const base: StoryInput = {
    name: "هەولێر بازاڕ",
    tagline: "هەنگوین و جل و بەرگ",
    url: "https://mymarket.app/s/hawler-bazaar",
    printedUrl: "mymarket.app/s/hawler-bazaar",
    logo: null,
    theme: resolveTheme("bazaar"),
    text: { cta: "ئێستا ئۆنلاین داوا بکە", scan: "سکان بکە", poweredBy: "دروستکراوە بە بازارگە" },
  };
  it("renders a 1080×1920 PNG with a monogram when there is no logo", async () => {
    const png = await renderStoryPng(base);
    const meta = await sharp(png).metadata();
    expect(meta).toMatchObject({ format: "png", width: STORY_SIZE.width, height: STORY_SIZE.height });
  });
  it("uses the logo, a custom accent and survives markup-looking / very long names", async () => {
    const logo = new Uint8Array(readFileSync("public/images/product-honey.jpg"));
    const png = await renderStoryPng({
      ...base,
      name: `<span>Tom & Jerry's</span> ${"Very long store name ".repeat(8)}`,
      tagline: "",
      logo,
      theme: resolveTheme("bazaar", "#1f8a5b"),
    });
    expect((await sharp(png).metadata()).height).toBe(STORY_SIZE.height);
  });
  it("an unreadable logo falls back to the monogram instead of failing", async () => {
    const png = await renderStoryPng({ ...base, logo: new Uint8Array([1, 2, 3]) });
    expect((await sharp(png).metadata()).width).toBe(STORY_SIZE.width);
  });
});

describe("share kit wiring", () => {
  it("is in the dashboard nav (More menu on mobile)", () => {
    const nav = readFileSync("src/components/dashboard/DashNav.tsx", "utf8");
    expect(nav).toMatch(/href: "\/dashboard\/share", key: "share", icon: QrCode, mobile: false/);
  });
  it("ku, ar, en and kmr have every share kit string", () => {
    const keys = ["title", "subtitle", "linkTitle", "linkHint", "bioTitle", "bioLine", "whatsapp", "qrTitle", "qrHint", "qrAlt", "downloadPng", "downloadSvg", "storyTitle", "storyHint", "storyAlt", "storyDownload", "storyCta", "storyScan"];
    for (const l of ["ku", "ar", "en", "kmr"]) {
      const m = JSON.parse(readFileSync(`messages/${l}.json`, "utf8")) as Record<string, Record<string, string>>;
      expect(m.dash!.share, `${l}.dash.share`).toBeTruthy();
      for (const k of keys) expect(m.shareKit![k], `${l}.shareKit.${k}`).toBeTruthy();
      expect(m.shareKit!.bioLine).toContain("{url}");
      expect(m.shareKit!.qrAlt).toContain("{url}");
    }
  });
  it("story fonts ship with the app and are traced into the standalone build", () => {
    for (const f of ["Vazirmatn-Bold.ttf", "Vazirmatn-Regular.ttf", "LICENSE-Vazirmatn.txt"]) expect(readFileSync(`src/server/share/fonts/${f}`).length).toBeGreaterThan(1000);
    expect(readFileSync("next.config.ts", "utf8")).toContain('"/api/share/story": ["./src/server/share/fonts/*.ttf"]');
  });
});
