import { z } from "zod";
import { AppError } from "../errors";
import { LANGUAGE_NAME, parseJsonText, type TextProvider } from "./text";

/** SF5: "Write with AI" in the product form → title, description and hashtags in one language. */
export type CopyLang = "ku" | "kmr" | "ar" | "en";
export type ProductCopyInput = {
  lang: CopyLang;
  /** Whatever the seller typed so far: a name in any language, notes, the old description. */
  hint: string;
  category?: string | null;
  price?: number | null;
  storeName: string;
};
export type ProductCopy = { title: string; description: string; hashtags: string[] };

export const productCopyInputSchema = z.object({
  lang: z.enum(["ku", "kmr", "ar", "en"]),
  hint: z.string().trim().min(2, "hint_required").max(600),
  category: z.string().trim().max(80).nullish(),
  price: z.coerce.number().int().nonnegative().max(1_000_000_000).nullish(),
});

const outSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  hashtags: z.array(z.string()).max(12).default([]),
});

export function productCopyPrompt(i: ProductCopyInput): { system: string; user: string } {
  const language = LANGUAGE_NAME[i.lang];
  return {
    system: `You write product listings for small Instagram/WhatsApp shops in Kurdistan and Iraq.
Write ONLY in ${language}. Return ONLY JSON: {"title":"…","description":"…","hashtags":["#…"]}.
Rules: title ≤ 8 words, no emoji, no price. Description 2–4 short, warm, honest sentences a shopper can trust:
what it is, what it's good for, one detail (material, size or use) only if the seller gave it; never invent specs, prices or claims.
hashtags: 5–8 relevant hashtags in the same language (plus 1–2 widely used English ones is fine), no spaces inside a tag.`,
    user: `Store: ${i.storeName}\nCategory: ${i.category || "-"}\nPrice (IQD): ${i.price ?? "-"}\nSeller notes:\n${i.hint}`,
  };
}

/** Clean a model answer: one-line title, trimmed text, #tags with no spaces, deduped. */
export function normalizeCopy(raw: unknown): ProductCopy {
  const p = outSchema.safeParse(raw);
  if (!p.success) throw new AppError("UNAVAILABLE", "ai_bad_shape");
  const tags = [...new Set(p.data.hashtags.map((t) => "#" + t.replace(/^#+/, "").replace(/[\s#,.،]+/g, "")).filter((t) => t.length > 1))].slice(0, 8);
  return { title: p.data.title.replace(/\s+/g, " ").slice(0, 200), description: p.data.description.slice(0, 2000), hashtags: tags };
}

const MOCK: Record<CopyLang, { lead: (n: string) => string; body: (cat: string | null) => string; tags: string[] }> = {
  ku: {
    lead: (n) => `${n} — هەڵبژاردەیەکی جوان و بەکەڵک بۆ ڕۆژانە.`,
    body: (c) => `${c ? `لە بەشی ${c}، ` : ""}بە وردی هەڵبژێردراوە و ئامادەیە بۆ گەیاندن. پرسیار هەبوو، لە واتسئاپ نامەمان بۆ بنێرە.`,
    tags: ["#کوردستان", "#هەولێر", "#سلێمانی", "#شۆپینگ"],
  },
  kmr: {
    lead: (n) => `${n} — bijarteyek xweşik û bikêr ji bo her roj.`,
    body: (c) => `${c ? `Di beşa ${c} de, ` : ""}bi baldarî hatiye hilbijartin û ji bo şandinê amade ye. Pirsên te hebin, li WhatsAppê ji me re binivîse.`,
    tags: ["#kurdistan", "#duhok", "#zaxo", "#kirîn"],
  },
  ar: {
    lead: (n) => `${n} — اختيار أنيق وعملي لكل يوم.`,
    body: (c) => `${c ? `من قسم ${c}، ` : ""}مختار بعناية وجاهز للتوصيل. لأي سؤال راسلنا على واتساب.`,
    tags: ["#العراق", "#أربيل", "#بغداد", "#تسوق"],
  },
  en: {
    lead: (n) => `${n}: a lovely, practical pick for every day.`,
    body: (c) => `${c ? `From our ${c} range, ` : ""}carefully chosen and ready to deliver. Questions? Message us on WhatsApp.`,
    tags: ["#kurdistan", "#erbil", "#iraq", "#shoponline"],
  },
};

/** Deterministic offline answer (dev, tests, the demo store): same input → same output, no network. */
export function mockProductCopy(i: ProductCopyInput): ProductCopy {
  const firstLine = i.hint.split(/\n/)[0]!.replace(/\s+/g, " ").trim();
  const words = firstLine.split(" ").slice(0, 6).join(" ");
  const title = words.charAt(0).toUpperCase() + words.slice(1);
  const m = MOCK[i.lang];
  const storeTag = "#" + i.storeName.replace(/[\s#,.،]+/g, "");
  return normalizeCopy({ title, description: `${m.lead(title)} ${m.body(i.category ?? null)}`, hashtags: [storeTag, ...m.tags] });
}

export async function generateProductCopy(provider: TextProvider, input: ProductCopyInput): Promise<ProductCopy> {
  if (provider.name === "mock") return mockProductCopy(input);
  const { system, user } = productCopyPrompt(input);
  return normalizeCopy(parseJsonText(await provider.json({ system, user })));
}
