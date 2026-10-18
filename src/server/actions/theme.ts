"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { stores } from "../db/schema";
import { requireOwner } from "../auth/session";
import { invalidateStore } from "../cache/tags";
import { themeSchema } from "@/lib/theme-studio/schema";
import { toActionState, type ActionState } from "./util";

/** Save the draft theme for the signed-in seller's own store (store id from the session only). */
export async function saveThemeDraftAction(raw: unknown): Promise<ActionState> {
  try {
    const { store } = await requireOwner();
    const theme = themeSchema.parse(raw);
    await db().update(stores).set({ themeDraft: theme }).where(eq(stores.id, store.id));
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

/** Publish: validate the given theme, store it as draft and published together. */
export async function publishThemeAction(raw: unknown): Promise<ActionState> {
  try {
    const { store } = await requireOwner();
    const theme = themeSchema.parse(raw);
    await db().update(stores).set({ themeDraft: theme, themePublished: theme }).where(eq(stores.id, store.id));
    invalidateStore(store.id, [store.slug]);
    revalidatePath(`/s/${store.slug}`, "layout");
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}
