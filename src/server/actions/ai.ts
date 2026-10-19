"use server";
import { flagOn } from "../services/platform-settings";
import { db } from "../db";
import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";
import { categories, products } from "../db/schema";
import { requireOwner, requireStore } from "../auth/session";
import { assertFeature } from "../plan-gate";
import { AppError } from "../errors";
import { enforceRateLimit } from "../auth/rate-limit";
import { textProviderFor } from "../ai/access";
import { generateProductCopy, productCopyInputSchema, type ProductCopy } from "../ai/product-copy";
import { composeDesigns, composeInputSchema, type CatalogContext, type DesignOption } from "../ai/design-composer";
import { pickText, type Locale } from "@/lib/i18n";
import { consumeAiCredit, refundAiCredit } from "../services/ai-quota";
import { toActionState, type ActionState } from "./util";

export type ProductCopyResult = ActionState & { copy?: ProductCopy; remaining?: number };

/**
 * SF5 "Write with AI": title, description and hashtags in one language. Business+ (server gate), monthly credits
 * (AI_MONTHLY_LIMIT.aiDescriptions) and 8 calls/minute per store. A failed provider call gives the credit back.
 */
export async function writeProductCopyAction(input: { lang: string; hint: string; category?: string | null; price?: number | string | null }): Promise<ProductCopyResult> {
  try {
    const { store, user } = await requireStore();
    assertFeature(store, "aiDescriptions");
    if (!(await flagOn(db(), "aiDescriptions"))) throw new AppError("UNAVAILABLE", "ai_disabled");
    const provider = textProviderFor(user.email);
    if (!provider) throw new AppError("UNAVAILABLE", "ai_disabled");
    const parsed = productCopyInputSchema.parse({ ...input, price: input.price === "" ? null : input.price });
    await enforceRateLimit(db(), `ai:desc:${store.id}`, 8, 60);
    const usage = await consumeAiCredit(db(), store.id, "aiDescriptions");
    try {
      const copy = await generateProductCopy(provider, { ...parsed, storeName: store.name || "Shop" });
      return { ok: true, copy, remaining: usage.remaining };
    } catch (e) {
      await refundAiCredit(db(), store.id, "aiDescriptions");
      throw e;
    }
  } catch (e) {
    return toActionState(e);
  }
}

export type ComposeDesignsResult = ActionState & { options?: DesignOption[]; remaining?: number };

/** The store's real catalogue, summarised for the composer (names in the store language, capped samples). */
async function catalogContext(storeId: string, lang: Locale, hasCover: boolean): Promise<CatalogContext> {
  const live = and(eq(products.storeId, storeId), eq(products.isActive, true), isNull(products.hiddenByAdminAt));
  const [cats, rows, [total]] = await Promise.all([
    db().select({ name: categories.name }).from(categories).where(eq(categories.storeId, storeId)).orderBy(asc(categories.sort)).limit(12),
    db()
      .select({
        name: products.name, price: products.price, compareAt: products.compareAtPrice,
        hasImage: sql<boolean>`exists (select 1 from "product_images" pi where pi.product_id = "products"."id")`,
      })
      .from(products).where(live).orderBy(asc(products.sort), desc(products.createdAt)).limit(24),
    db().select({ n: count() }).from(products).where(live),
  ]);
  const clip = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, 60);
  return {
    categories: cats.map((c) => clip(pickText(c.name, lang))).filter(Boolean),
    products: rows.map((r) => ({ title: clip(pickText(r.name, lang)), price: r.price, onSale: r.compareAt != null && r.compareAt > r.price, hasImage: !!r.hasImage })).filter((p) => p.title),
    productCount: Number(total?.n ?? 0),
    hasCover,
  };
}

/**
 * SF10 AI Website Designer v2: a brand brief (+ optional vibe) + the store's real catalogue → THREE complete designs
 * (base, every section variant, section order, type pair, contrast-checked palette, copy in the store language), each
 * with a live preview token. Owner only, Max only (server gate), aiDesigner admin flag, 1 credit per generation of
 * three (AI_MONTHLY_LIMIT.aiDesigner), 4 calls/minute + 20/hour per store; a failed provider call gives the credit
 * back. Nothing is saved here: the seller picks an option into the draft (the normal autosave) and publishes or
 * discards it in Theme Studio (publishThemeAction keeps the premium gate).
 */
export async function composeStoreDesignsAction(input: { brief: string; vibe?: string | null }): Promise<ComposeDesignsResult> {
  try {
    const { store, user } = await requireOwner();
    assertFeature(store, "aiDesigner");
    if (!(await flagOn(db(), "aiDesigner"))) throw new AppError("UNAVAILABLE", "ai_disabled");
    const provider = textProviderFor(user.email);
    if (!provider) throw new AppError("UNAVAILABLE", "ai_disabled");
    const parsed = composeInputSchema.parse({ brief: input.brief, vibe: input.vibe || null });
    await enforceRateLimit(db(), `ai:design:${store.id}`, 4, 60);
    await enforceRateLimit(db(), `ai:design:h:${store.id}`, 20, 3600);
    const lang = (["ku", "kmr", "ar", "en"] as const).find((l) => l === store.defaultLocale) ?? "ku";
    const catalog = await catalogContext(store.id, lang, !!store.coverImageUrl);
    const usage = await consumeAiCredit(db(), store.id, "aiDesigner");
    try {
      const options = await composeDesigns(provider, { ...parsed, lang, storeName: store.name || "Shop", catalog });
      return { ok: true, options, remaining: usage.remaining };
    } catch (e) {
      await refundAiCredit(db(), store.id, "aiDesigner");
      throw e;
    }
  } catch (e) {
    return toActionState(e);
  }
}
