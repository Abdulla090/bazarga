"use server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { stores } from "@/server/db/schema";
import { requireStore } from "@/server/auth/session";
import { THEME_STUDIO_PRESETS } from "@/lib/theme-studio/presets";

/** Apply a Theme Studio preset (draft + published) to the signed-in seller's own store. */
export async function applyPresetAction(formData: FormData): Promise<void> {
  const { store } = await requireStore();
  const theme = THEME_STUDIO_PRESETS[String(formData.get("preset") ?? "")];
  if (theme) await db().update(stores).set({ themeDraft: theme, themePublished: theme }).where(eq(stores.id, store.id));
  redirect("/dashboard");
}
