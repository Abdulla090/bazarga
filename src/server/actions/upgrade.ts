"use server";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { requireStore } from "../auth/session";
import { enforceRateLimit } from "../auth/rate-limit";
import { requireAdmin } from "../auth/admin";
import { activateRequest, createUpgradeRequest, rejectRequest } from "../services/upgrades";
import { toActionState, type ActionState } from "./util";
import { eq } from "drizzle-orm";
import { stores, upgradeRequests } from "../db/schema";
import { invalidateStore } from "../cache/tags";

export async function requestUpgradeAction(raw: unknown): Promise<ActionState> {
  try {
    const { store } = await requireStore();
    await enforceRateLimit(db(), `upgrade-request:${store.id}`, 10, 3600);
    await createUpgradeRequest(db(), store.id, raw);
    revalidatePath("/dashboard/upgrade");
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

export async function activateUpgradeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id"));
  await activateRequest(db(), id);
  // The storefront footer badge depends on the plan: drop the cached store.
  const req = await db().query.upgradeRequests.findFirst({ where: eq(upgradeRequests.id, id) });
  const st = req ? await db().query.stores.findFirst({ where: eq(stores.id, req.storeId), columns: { id: true, slug: true } }) : null;
  if (st) invalidateStore(st.id, [st.slug]);
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
