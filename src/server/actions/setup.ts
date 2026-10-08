"use server";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { requireStore } from "../auth/session";
import { confirmDeliveryFees, markLinkShared } from "../services/setup";
import { toActionState, type ActionState } from "./util";

/** Called by the dashboard's copy/share buttons. Store id comes from the session only. */
export async function markLinkSharedAction(): Promise<ActionState> {
  try {
    const { store } = await requireStore();
    if (await markLinkShared(db(), store.id)) revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

export async function confirmDeliveryFeesAction(): Promise<void> {
  const { store } = await requireStore();
  await confirmDeliveryFees(db(), store.id);
  revalidatePath("/dashboard");
}
