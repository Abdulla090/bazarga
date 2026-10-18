import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { stores } from "@/server/db/schema";
import { AI_MONTHLY_LIMIT, COMPARE, getPlan, hasFeature } from "@/lib/plans";
import { GeminiText, MockText } from "@/server/ai/text";
import { generateSiteDesign, mockSiteDesign, normalizeSiteDesign, siteDesignInputSchema, siteDesignPrompt } from "@/server/ai/site-design";
import { themeSchema } from "@/lib/theme-studio/schema";
import { contrast } from "@/lib/theme-studio/contrast";
import { consumeAiCredit, getAiUsage } from "@/server/services/ai-quota";
import { seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => { database = await testDb(); });

const ok = {
  design: "atelier",
  palette: { accent: "#b08d57", bg: "#16120F", surface: "#201A16", text: "#F3EDE4" },
  fontPair: "serif-editorial",
  buttons: { shape: "square", style: "outline" },
  cards: { radius: "none", style: "hairline", ratio: "portrait" },
  background: "solid",
  headerLayout: "centered",
  headline: "بەخێربێن",
  tagline: "بۆنی دەستکرد لە هەولێر",
};

describe("AI Website Designer (SF10)", () => {
  it("is Max-only with monthly credits, and no longer marked Soon (monthly refresh still is)", () => {
    expect(hasFeature("max", "aiDesigner")).toBe(true);
    for (const p of ["free", "pro", "business"] as const) expect(hasFeature(p, "aiDesigner")).toBe(false);
    expect(AI_MONTHLY_LIMIT.aiDesigner.max).toBeGreaterThan(0);
    expect(AI_MONTHLY_LIMIT.aiDesigner.business).toBe(0);
    const f = (k: string) => getPlan("max").features.find((x) => x.key === k);
    expect(f("aiDesigner")?.soon).toBeFalsy();
    expect(f("designRefresh")?.soon).toBe(true);
    expect(COMPARE.find((r) => r.key === "aiDesigner")!.max).toBe(true);
  });

  it("brief must be a few words, vibe is optional and from the list", () => {
    expect(siteDesignInputSchema.safeParse({ brief: "x" }).success).toBe(false);
    expect(siteDesignInputSchema.parse({ brief: "  handmade perfume  " }).brief).toBe("handmade perfume");
    expect(siteDesignInputSchema.safeParse({ brief: "perfume shop", vibe: "weird" }).success).toBe(false);
    expect(siteDesignInputSchema.parse({ brief: "perfume shop", vibe: "luxury" }).vibe).toBe("luxury");
  });

  it("prompt names the store language and every design incl. premium Atelier/Pulse", () => {
    const p = siteDesignPrompt({ brief: "b", lang: "kmr", storeName: "S" });
    expect(p.system).toContain("Kurmanji");
    for (const d of ["classic", "editorial", "gallery", "boutique", "mono", "studio", "market", "atelier", "pulse"]) expect(p.system).toContain(d);
    expect(p.system).toMatch(/Never invent prices/);
    expect(siteDesignPrompt({ brief: "b", lang: "ku", storeName: "S" }).system).toContain("Sorani");
  });

  it("normalizes a model answer into a valid Theme Studio draft with copy in the store language", () => {
    const t = normalizeSiteDesign(ok, "ku");
    expect(themeSchema.safeParse(t).success).toBe(true);
    expect(t.design).toBe("atelier");
    expect(t.preset).toBe("ai");
    expect(t.colors.accent).toBe("#B08D57");
    expect(t.copy).toEqual({ lang: "ku", tagline: "بۆنی دەستکرد لە هەولێر" });
    expect(t.header.announce).toBe("بەخێربێن");
  });

  it("fixes unreadable colours and fills missing parts from the design's preset", () => {
    const t = normalizeSiteDesign({ design: "market", palette: { accent: "#FFFFFE", bg: "#FFFFFF", text: "#EEEEEE" }, fontPair: "sans-clean", tagline: "x".repeat(300) }, "en");
    expect(contrast(t.colors.text, t.colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.colors.accent, t.colors.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(t.colors.text, t.colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(t.cards.ratio).toBe("square");
    expect(t.copy!.tagline.length).toBeLessThanOrEqual(140);
    expect(() => normalizeSiteDesign({ design: "nope", palette: {}, fontPair: "x", tagline: "y" }, "en")).toThrow();
  });

  it("mock is deterministic, keyword-aware and writes in each language", () => {
    const a = mockSiteDesign({ brief: "luxury perfumes and gold jewellery", lang: "en", storeName: "Nur" });
    expect(a).toEqual(mockSiteDesign({ brief: "luxury perfumes and gold jewellery", lang: "en", storeName: "Nur" }));
    expect(a.design).toBe("atelier");
    expect(mockSiteDesign({ brief: "sneakers and streetwear drops", lang: "en", storeName: "N" }).design).toBe("pulse");
    expect(mockSiteDesign({ brief: "زۆر شت", vibe: "playful", lang: "ku", storeName: "N" }).design).toBe("boutique");
    const ku = mockSiteDesign({ brief: "گوڵ و دیاری", lang: "ku", storeName: "Studio Hawler" });
    expect(ku.copy!.lang).toBe("ku");
    expect(ku.copy!.tagline).toMatch(/[\u0600-\u06FF]/);
    expect(ku.header.announce).toContain("Studio Hawler");
    const kmr = mockSiteDesign({ brief: "gul û diyarî", lang: "kmr", storeName: "S" });
    expect(kmr.copy!.tagline).not.toMatch(/[\u0600-\u06FF]/);
    for (const lang of ["ku", "kmr", "ar", "en"] as const) expect(themeSchema.safeParse(mockSiteDesign({ brief: "coffee and books", lang, storeName: "S" })).success).toBe(true);
  });

  it("uses the real provider when configured (JSON mode)", async () => {
    const fake = (async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "```json\n" + JSON.stringify({ ...ok, design: "pulse" }) + "\n```" }] } }] }), { status: 200 })) as unknown as typeof fetch;
    const t = await generateSiteDesign(new GeminiText({ apiKey: "K", model: "m" }, fake), { brief: "sneakers", lang: "ku", storeName: "S" });
    expect(t.design).toBe("pulse");
    expect((await generateSiteDesign(new MockText(), { brief: "sneakers", lang: "en", storeName: "S" })).design).toBe("pulse");
  });

  it("credits: Max spends from its own monthly pool, lower plans get none", async () => {
    const { store } = await seller(database, "designer-max");
    const now = new Date("2026-10-18T12:00:00Z");
    await expect(consumeAiCredit(database, store.id, "aiDesigner", now)).rejects.toThrow();
    await database.update(stores).set({ plan: "max" }).where(eq(stores.id, store.id));
    const u = await consumeAiCredit(database, store.id, "aiDesigner", now);
    expect(u.used).toBe(1);
    expect(u.remaining).toBe(AI_MONTHLY_LIMIT.aiDesigner.max - 1);
    expect((await getAiUsage(database, store.id, "aiDescriptions", now)).used).toBe(0);
  });

  it("server action: owner + Max gate, rate limit, credits, refund; publish copies the tagline", () => {
    const src = readFileSync("src/server/actions/ai.ts", "utf8");
    const fn = src.slice(src.indexOf("export async function designStoreWithAiAction"));
    expect(fn).toContain("requireOwner()");
    expect(fn).toContain('assertFeature(store, "aiDesigner")');
    expect(fn).toMatch(/enforceRateLimit\(db\(\), `ai:design:/);
    expect(fn).toContain('consumeAiCredit(db(), store.id, "aiDesigner")');
    expect(fn).toContain('refundAiCredit(db(), store.id, "aiDesigner")');
    expect(fn).toContain("themeDraft: theme");
    expect(fn).not.toContain("themePublished");
    const theme = readFileSync("src/server/actions/theme.ts", "utf8");
    expect(theme).toContain("theme.copy?.tagline");
  });
});
