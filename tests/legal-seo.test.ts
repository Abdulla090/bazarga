import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { products, stores } from "@/server/db/schema";
import { LEGAL, LEGAL_DOCS } from "@/lib/legal";
import { LEGAL_AGREE_LINKS, LEGAL_PATH, LEGAL_UI, splitAgree } from "@/lib/legal-ui";
import { LOCALES } from "@/lib/i18n";
import { ROBOTS_DISALLOW, STATIC_PUBLIC_PATHS, siteUrl } from "@/lib/seo";
import { loadSitemapEntries } from "@/server/services/sitemap";
import { product, seller, testDb } from "./support/db";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
const ARABIC = /[\u0600-\u06FF]/;

describe("legal pages content (4 locales)", () => {
  it("every document exists in every locale with the same structure", () => {
    for (const doc of LEGAL_DOCS) {
      const en = LEGAL[doc].en;
      expect(en.sections.length).toBeGreaterThanOrEqual(5);
      for (const l of LOCALES) {
        const p = LEGAL[doc][l];
        expect(p.title.length, `${doc}/${l}`).toBeGreaterThan(3);
        expect(p.sections.length, `${doc}/${l}`).toBe(en.sections.length);
        p.sections.forEach((s, i) => expect(s.p.length, `${doc}/${l}/${i}`).toBe(en.sections[i]!.p.length));
      }
    }
  });
  it("script per locale: kmr Latin, ku/ar Arabic script", () => {
    for (const doc of LEGAL_DOCS) {
      expect(JSON.stringify(LEGAL[doc].kmr)).not.toMatch(ARABIC);
      expect(LEGAL[doc].ku.intro).toMatch(ARABIC);
      expect(LEGAL[doc].ar.intro).toMatch(ARABIC);
    }
    for (const l of LOCALES) expect(Object.keys(LEGAL_UI[l].nav).sort()).toEqual([...LEGAL_DOCS].sort());
    expect(JSON.stringify(LEGAL_UI.kmr)).not.toMatch(ARABIC);
  });
  it("facts match the product: month to month, cancel anytime, no IP stored for visits, 7-day plan refunds", () => {
    expect(LEGAL.terms.en.sections.map((s) => s.p.join(" ")).join(" ")).toMatch(/cancel any time/);
    expect(LEGAL.privacy.en.sections.map((s) => s.p.join(" ")).join(" ")).toMatch(/without storing IP addresses/);
    expect(LEGAL.refund.en.sections[0]!.p.join(" ")).toMatch(/within 7 days/);
  });
  it("the signup agreement line links both documents in every locale", () => {
    for (const l of LOCALES) {
      const parts = splitAgree(l);
      expect(parts.filter((p) => p.link).map((p) => p.link)).toEqual(["terms", "privacy"]);
      expect(parts.find((p) => p.link === "terms")!.text).toBe(LEGAL_AGREE_LINKS[l].terms);
      expect(parts.map((p) => p.text).join("")).not.toContain("{");
    }
  });
  it("legal copy never ships to the client: the full text module is server-only, signup gets a server-rendered node", () => {
    expect(read("src/lib/legal.ts")).toContain('import "server-only"');
    const form = read("src/app/(auth)/signup/SignupForm.tsx");
    expect(form).not.toContain("@/lib/legal");
    expect(read("src/app/(auth)/signup/page.tsx")).toContain("splitAgree(");
  });
  it("routes, footer and signup are wired", () => {
    for (const d of LEGAL_DOCS) expect(read(`src/app/(marketing)/${d}/page.tsx`)).toContain(`"${d}"`);
    expect(read("src/components/SiteFooter.tsx")).toContain("LEGAL_PATH[d]");
    expect(LEGAL_PATH).toEqual({ terms: "/terms", privacy: "/privacy", refund: "/refund" });
  });
  it("no orange/yellow in the new UI", () => {
    for (const f of ["src/components/LegalDocument.tsx", "src/components/SiteFooter.tsx"]) expect(read(f)).not.toMatch(/orange|yellow|amber|#F5B700|#F59E0B/i);
  });
});

describe("SEO: robots, sitemap, metadata", () => {
  let database: Db;
  beforeAll(async () => {
    database = await testDb();
  });

  it("siteUrl normalises APP_URL and survives garbage", () => {
    expect(siteUrl("https://bazarga.app/")).toBe("https://bazarga.app");
    expect(siteUrl("not a url")).toBe("http://localhost:3000");
  });
  it("robots keeps private and per-shopper pages out and points at the sitemap", () => {
    for (const p of ["/dashboard", "/admin", "/api/", "/onboarding", "/payments/", "/s/*/order/", "/s/*/track", "/s/*/cart"]) expect(ROBOTS_DISALLOW).toContain(p);
    expect(read("src/app/robots.ts")).toContain("sitemap.xml");
    expect(STATIC_PUBLIC_PATHS).toEqual(["/", "/pricing", "/terms", "/privacy", "/refund"]);
  });
  it("sitemap lists only active stores and active products of active stores", async () => {
    const a = await seller(database, "sma");
    const b = await seller(database, "smb");
    const pa = await product(database, a.store.id, 1000);
    const hidden = await product(database, a.store.id, 1000);
    await database.update(products).set({ isActive: false }).where(eq(products.id, hidden.id));
    const pb = await product(database, b.store.id, 1000);
    await database.update(stores).set({ isActive: false }).where(eq(stores.id, b.store.id));
    const e = await loadSitemapEntries(database);
    const storeSlugs = e.stores.map((s) => s.slug);
    expect(storeSlugs).toContain(a.store.slug);
    expect(storeSlugs).not.toContain(b.store.slug);
    const ids = e.products.map((p) => p.id);
    expect(ids).toContain(pa.id);
    expect(ids).not.toContain(hidden.id);
    expect(ids).not.toContain(pb.id);
    expect(e.products.find((p) => p.id === pa.id)!.slug).toBe(a.store.slug);
  });
  it("root metadata has metadataBase, Open Graph and a Twitter card with a 1200×630 image", async () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain("metadataBase");
    expect(layout).toContain('card: "summary_large_image"');
    expect(layout).toContain("/og.png");
    const meta = await sharp(path.join(process.cwd(), "public/og.png")).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 630]);
  });
});
