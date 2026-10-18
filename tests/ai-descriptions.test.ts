import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { stores } from "@/server/db/schema";
import { AI_MONTHLY_LIMIT, getPlan, hasFeature } from "@/lib/plans";
import { GeminiText, OpenAIText, resolveTextProvider, MockText } from "@/server/ai/text";
import { generateProductCopy, mockProductCopy, normalizeCopy, productCopyInputSchema, productCopyPrompt } from "@/server/ai/product-copy";
import { consumeAiCredit, getAiUsage, refundAiCredit } from "@/server/services/ai-quota";
import { seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => { database = await testDb(); });

describe("AI text provider selection (buyer keys only)", () => {
  it("gemini > openai > AI_API_KEY; mock only when asked; nothing → off", () => {
    expect(resolveTextProvider({})).toBeNull();
    expect(resolveTextProvider({ GEMINI_API_KEY: "g", OPENAI_API_KEY: "o" })?.name).toBe("gemini");
    expect(resolveTextProvider({ OPENAI_API_KEY: "o" })?.name).toBe("openai");
    expect(resolveTextProvider({ AI_ENABLED: true, AI_API_KEY: "k" })?.name).toBe("openai");
    expect(resolveTextProvider({ AI_API_KEY: "k" })).toBeNull();
    expect(resolveTextProvider({ AI_ENABLED: true, AI_PROVIDER: "mock" })?.name).toBe("mock");
    expect(resolveTextProvider({ GEMINI_API_KEY: "  " })).toBeNull();
  });

  it("Gemini and OpenAI send the key in a header and JSON mode", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const body = url.includes("googleapis")
        ? { candidates: [{ content: { parts: [{ text: '{"title":"T","description":"D","hashtags":["a b","#c"]}' }] } }] }
        : { choices: [{ message: { content: '```json\n{"title":"T","description":"D","hashtags":[]}\n```' } }] };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const input = { lang: "ku" as const, hint: "کراسی پەمۆ", storeName: "Studio Hawler" };
    const g = await generateProductCopy(new GeminiText({ apiKey: "KEY", model: "m" }, fake), input);
    expect(g).toEqual({ title: "T", description: "D", hashtags: ["#ab", "#c"] });
    expect(calls[0]!.url).not.toContain("KEY");
    expect((calls[0]!.init.headers as Record<string, string>)["x-goog-api-key"]).toBe("KEY");
    expect(JSON.parse(String(calls[0]!.init.body)).generationConfig.responseMimeType).toBe("application/json");
    const o = await generateProductCopy(new OpenAIText({ baseUrl: "https://x/v1", apiKey: "K2", model: "m" }, fake), { ...input, lang: "en" });
    expect(o.title).toBe("T");
    expect(JSON.parse(String(calls[1]!.init.body)).response_format).toEqual({ type: "json_object" });
  });

  it("prompts name the store language and forbid invented prices", () => {
    const p = productCopyPrompt({ lang: "ku", hint: "x", storeName: "S" });
    expect(p.system).toContain("Sorani Kurdish");
    expect(p.system).toMatch(/never invent/);
    expect(productCopyPrompt({ lang: "kmr", hint: "x", storeName: "S" }).system).toContain("Kurmanji");
  });
});

describe("product copy", () => {
  it("mock is deterministic and in the asked language", () => {
    const a = mockProductCopy({ lang: "ku", hint: "کراسی پەمۆ\nسپی", storeName: "Studio Hawler", category: "جل" });
    expect(a).toEqual(mockProductCopy({ lang: "ku", hint: "کراسی پەمۆ\nسپی", storeName: "Studio Hawler", category: "جل" }));
    expect(a.title).toBe("کراسی پەمۆ");
    expect(a.description).toMatch(/[\u0600-\u06FF]/);
    expect(a.hashtags[0]).toBe("#StudioHawler");
    expect(a.hashtags.every((t) => t.startsWith("#") && !/\s/.test(t))).toBe(true);
    expect(mockProductCopy({ lang: "en", hint: "cotton shirt", storeName: "S" }).title).toBe("Cotton shirt");
  });
  it("rejects bad model output and empty hints", async () => {
    expect(() => normalizeCopy({ title: "" })).toThrow();
    expect(() => productCopyInputSchema.parse({ lang: "en", hint: " " })).toThrow();
    expect(() => productCopyInputSchema.parse({ lang: "fr", hint: "ok ok" })).toThrow();
    expect(await generateProductCopy(new MockText(), { lang: "ar", hint: "ساعة", storeName: "S" })).toHaveProperty("hashtags");
  });
});

describe("AI plan gate + monthly credits", () => {
  it("Business+ only, credits by plan, Soon tag gone", () => {
    expect(hasFeature("pro", "aiDescriptions")).toBe(false);
    expect(hasFeature("business", "aiDescriptions")).toBe(true);
    expect(AI_MONTHLY_LIMIT.aiDescriptions.pro).toBe(0);
    expect(getPlan("business").features.find((f) => f.key === "aiDescriptions")?.soon).toBeUndefined();
  });

  it("consume is atomic and capped; refund gives one back; Pro has none", async () => {
    const { store } = await seller(database, "aiq");
    await expect(consumeAiCredit(database, store.id, "aiDescriptions")).rejects.toThrow("plan_limit_ai");
    await database.update(stores).set({ plan: "business" }).where(eq(stores.id, store.id));
    const now = new Date("2026-10-18T12:00:00Z");
    const limit = AI_MONTHLY_LIMIT.aiDescriptions.business;
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => consumeAiCredit(database, store.id, "aiDescriptions", now)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(12);
    expect((await getAiUsage(database, store.id, "aiDescriptions", now)).used).toBe(12);
    await refundAiCredit(database, store.id, "aiDescriptions", now);
    expect((await getAiUsage(database, store.id, "aiDescriptions", now)).remaining).toBe(limit - 11);
    // A different feature and a different month are separate buckets.
    expect((await getAiUsage(database, store.id, "aiDesigner", now)).used).toBe(0);
    expect((await getAiUsage(database, store.id, "aiDescriptions", new Date("2026-11-01T00:00:00Z"))).used).toBe(0);
  });

  it("the action enforces plan, provider, rate limit and credits server-side", () => {
    const src = readFileSync("src/server/actions/ai.ts", "utf8");
    expect(src).toContain('assertFeature(store, "aiDescriptions")');
    expect(src).toContain("enforceRateLimit(");
    expect(src).toContain("consumeAiCredit(");
    expect(src).toContain("refundAiCredit(");
  });
});
