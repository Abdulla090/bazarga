import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import manifest from "@/app/manifest";
import { buildCsp } from "@/server/csp";

describe("web app manifest", () => {
  const m = manifest();
  it("is Kurdish-first and on brand", () => {
    expect(m.name).toBe("Bazarga / بازارگە");
    expect(m.dir).toBe("rtl");
    expect(m.lang).toBe("ku");
    expect(m.theme_color).toBe("#0F1B2D");
    expect(m.background_color).toBe("#FAF7F0");
    expect(m.display).toBe("standalone");
  });
  it("ships maskable 192/512 PNG icons that exist on disk", () => {
    const maskable = (m.icons ?? []).filter((i) => i.purpose === "maskable");
    expect(maskable.map((i) => i.sizes).sort()).toEqual(["192x192", "512x512"]);
    for (const icon of m.icons ?? []) expect(existsSync(`public${icon.src}`)).toBe(true);
    expect(existsSync("public/apple-touch-icon.png")).toBe(true);
  });
});

describe("service worker", () => {
  const sw = readFileSync("public/sw.js", "utf8");
  it("leaves non-GET requests (server actions, checkout) to the network", () => {
    expect(sw).toMatch(/if \(req\.method !== "GET"\) return;/);
  });
  it("never handles /api except image renditions, and never stores dashboard/checkout HTML", () => {
    expect(sw).toMatch(/if \(path\.startsWith\("\/api\/"\)\) return;/);
    expect(sw).toMatch(/path\.startsWith\("\/dashboard"\)/);
    expect(sw).toMatch(/cart\|checkout\|order/);
  });
  it("precaches the offline page and its font", () => {
    expect(sw).toContain('"/offline.html"');
    expect(sw).toContain('"/fonts/vazirmatn-arabic.woff2"');
    expect(existsSync("public/fonts/vazirmatn-arabic.woff2")).toBe(true);
    const offline = readFileSync("public/offline.html", "utf8");
    expect(offline).toContain('dir="rtl"');
    expect(offline).not.toMatch(/<script/i);
  });
});

describe("CSP stays nonce-based", () => {
  it("has no 'unsafe-inline' for scripts", () => {
    const csp = buildCsp({ nonce: "abc", isDev: false });
    const script = csp.split("; ").find((d) => d.startsWith("script-src"))!;
    expect(script).toContain("'nonce-abc'");
    expect(script).not.toContain("unsafe-inline");
  });
});
