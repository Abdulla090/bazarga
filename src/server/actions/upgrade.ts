"use server";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { requireStore } from "../auth/session";
import { requireAdmin } from "../auth/admin";
import { activateRequest, createUpgradeRequest, rejectRequest } from "../services/upgrades";
import { toActionState, type ActionState } from "./util";

export async function requestUpgradeAction(raw: unknown): Promise<ActionState> {
  try {
    const { store } = await requireStore();
    await createUpgradeRequest(db(), store.id, raw);
    revalidatePath("/dashboard/upgrade");
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

export async function activateUpgradeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  await activateRequest(db(), String(formData.get("id")));
  revalidatePath("/admin");
}

export async function rejectUpgradeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  await rejectRequest(db(), String(formData.get("id")));
  revalidatePath("/admin");
}

/** Form-post variant used by /dashboard/upgrade (no client JS needed). */
export async function submitUpgradeForm(formData: FormData): Promise<void> {
  const { store } = await requireStore();
  const months = Number(formData.get("months"));
  await createUpgradeRequest(db(), store.id, { plan: formData.get("plan"), months, method: formData.get("method") });
  revalidatePath("/dashboard/upgrade");
}
