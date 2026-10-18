"use server";
import { flagOn } from "../services/platform-settings";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { stores } from "../db/schema";
import { requireOwner, requireStore } from "../auth/session";
import { assertFeature } from "../plan-gate";
import { AppError } from "../errors";
import { enforceRateLimit } from "../auth/rate-limit";
import { textProviderFor } from "../ai/access";
import { generateProductCopy, productCopyInputSchema, type ProductCopy } from "../ai/product-copy";
import { generateSiteDesign, siteDesignInputSchema } from "../ai/site-design";
import type { StoreTheme } from "@/lib/theme-studio/schema";
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

export type SiteDesignResult = ActionState & { theme?: StoreTheme; remaining?: number };

/**
 * SF10 AI Website Designer: a brand brief (+ optional vibe) → a Theme Studio *draft* (design, palette, fonts, header
 * line, hero tagline in the store language). Owner only, Max only (server gate), monthly credits
 * (AI_MONTHLY_LIMIT.aiDesigner) and 4 calls/minute + 20/hour per store. A failed provider call gives the credit back.
 * Publishing stays a separate, explicit step (publishThemeAction).
 */
export async function designStoreWithAiAction(input: { brief: string; vibe?: string | null }): Promise<SiteDesignResult> {
  try {
    const { store, user } = await requireOwner();
    assertFeature(store, "aiDesigner");
    const provider = textProviderFor(user.email);
    if (!provider) throw new AppError("UNAVAILABLE", "ai_disabled");
    const parsed = siteDesignInputSchema.parse({ brief: input.brief, vibe: input.vibe || null });
    await enforceRateLimit(db(), `ai:design:${store.id}`, 4, 60);
    await enforceRateLimit(db(), `ai:design:h:${store.id}`, 20, 3600);
    const usage = await consumeAiCredit(db(), store.id, "aiDesigner");
    try {
      const lang = (["ku", "kmr", "ar", "en"] as const).find((l) => l === store.defaultLocale) ?? "ku";
      const theme = await generateSiteDesign(provider, { ...parsed, lang, storeName: store.name || "Shop" });
      await db().update(stores).set({ themeDraft: theme }).where(eq(stores.id, store.id));
      return { ok: true, theme, remaining: usage.remaining };
    } catch (e) {
      await refundAiCredit(db(), store.id, "aiDesigner");
      throw e;
    }
  } catch (e) {
    return toActionState(e);
  }
}
