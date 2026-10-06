import { z } from "zod";
import { env } from "../env";
import { AppError } from "../errors";
import { logger } from "../logger";

/**
 * AI store builder hook: photos + a free-text message in any language (Kurdish, Arabic, English…)
 * → draft products the seller reviews and confirms. Nothing is saved until the seller confirms.
 */
export type PhotoInput = { mime: string; base64: string; url?: string };
export type DraftProduct = {
  name: { ku?: string; ar?: string; en?: string };
  description: { ku?: string; ar?: string; en?: string };
  price: number | null;
  category: string | null;
  photoIndexes: number[];
};

export interface VisionProvider {
  readonly name: string;
  createProductsFromPhotos(input: { photos: PhotoInput[]; message: string; storeLocale: string }): Promise<DraftProduct[]>;
}

const draftSchema = z.object({
  products: z
    .array(
      z.object({
        name: z.object({ ku: z.string().optional(), ar: z.string().optional(), en: z.string().optional() }),
        description: z
          .object({ ku: z.string().optional(), ar: z.string().optional(), en: z.string().optional() })
          .default({}),
        price: z.number().int().nonnegative().nullable().default(null),
        category: z.string().nullable().default(null),
        photoIndexes: z.array(z.number().int().nonnegative()).default([]),
      }),
    )
    .max(20),
});

export const SYSTEM_PROMPT = `You help small Instagram/WhatsApp sellers in Kurdistan and Iraq build an online store.
You receive product photos (numbered from 0) and a message from the seller in any language (often Sorani Kurdish, Kurmanji, Arabic, or English; prices are usually in Iraqi dinars, e.g. "85 هەزار" = 85000, "25 الف" = 25000, "40k" = 40000).
Return ONLY JSON: {"products":[{"name":{"ku":"…","ar":"…","en":"…"},"description":{"ku":"…","ar":"…","en":"…"},"price":85000,"category":"…","photoIndexes":[0]}]}
Rules: one entry per distinct product; names short (≤ 6 words); descriptions 1–2 warm, plain sentences; Sorani in Arabic script for "ku";
price is an integer in IQD or null if not stated — never invent a price; group photos of the same product.`;

/** Any OpenAI-compatible chat-completions endpoint with vision (OpenAI, OpenRouter, Together, vLLM, Ollama…). */
export class OpenAICompatibleVision implements VisionProvider {
  readonly name = "openai";
  constructor(
    private cfg: { baseUrl: string; apiKey: string; model: string },
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async createProductsFromPhotos(input: { photos: PhotoInput[]; message: string; storeLocale: string }) {
    const content: unknown[] = [
      { type: "text", text: `Store language: ${input.storeLocale}\nSeller message:\n${input.message || "(no message)"}` },
      ...input.photos.map((p) => ({ type: "image_url", image_url: { url: `data:${p.mime};base64,${p.base64}` } })),
    ];
    const res = await this.fetchImpl(`${this.cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.cfg.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
      }),
    });
    if (!res.ok) {
      logger.error("ai.request_failed", { status: res.status, body: (await res.text().catch(() => "")).slice(0, 500) });
      throw new AppError("UNAVAILABLE", "ai_failed");
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return parseDrafts(json.choices?.[0]?.message?.content ?? "", input.photos.length);
  }
}

/** Offline provider for demos/tests: one draft per photo, price parsed from the message if present. */
export class MockVision implements VisionProvider {
  readonly name = "mock";
  async createProductsFromPhotos(input: { photos: PhotoInput[]; message: string }) {
    const prices = [...input.message.matchAll(/(\d[\d,]*)\s*(k|هەزار|الف|ألف)?/gi)].map((m) => {
      const n = Number(m[1]!.replace(/,/g, ""));
      return m[2] ? n * 1000 : n;
    });
    return input.photos.map((_, i) => ({
      name: { ku: `کاڵای ${i + 1}`, ar: `منتج ${i + 1}`, en: `Product ${i + 1}` },
      description: {},
      price: prices[i] ?? null,
      category: null,
      photoIndexes: [i],
    }));
  }
}

export function parseDrafts(text: string, photoCount: number): DraftProduct[] {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new AppError("UNAVAILABLE", "ai_bad_json");
  }
  const parsed = draftSchema.safeParse(data);
  if (!parsed.success) throw new AppError("UNAVAILABLE", "ai_bad_shape");
  return parsed.data.products.map((p) => ({
    ...p,
    photoIndexes: p.photoIndexes.filter((i) => i < photoCount),
  }));
}

let provider: VisionProvider | null | undefined;
/** null when AI is disabled — the rest of the app runs without any key. */
export function visionProvider(): VisionProvider | null {
  if (provider !== undefined) return provider;
  const e = env();
  if (!e.AI_ENABLED) provider = null;
  else if (e.AI_PROVIDER === "mock") provider = new MockVision();
  else if (e.AI_API_KEY) provider = new OpenAICompatibleVision({ baseUrl: e.AI_BASE_URL, apiKey: e.AI_API_KEY, model: e.AI_MODEL });
  else provider = null;
  return provider;
}
export function setVisionProvider(p: VisionProvider | null | undefined) {
  provider = p;
}

export async function createProductsFromPhotos(input: { photos: PhotoInput[]; message: string; storeLocale: string }) {
  const p = visionProvider();
  if (!p) throw new AppError("UNAVAILABLE", "ai_disabled");
  if (!input.photos.length && !input.message.trim()) throw new AppError("VALIDATION", "nothing_to_read");
  return p.createProductsFromPhotos(input);
}
