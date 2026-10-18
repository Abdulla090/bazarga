"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../db";
import { requireOwner, requireStore } from "../auth/session";
import { assertFeature } from "../plan-gate";
import { recordAudit, auditDetail } from "../audit";
import { invalidateCatalog, invalidateStore } from "../cache/tags";
import { updateProductSeo, updateStoreSeo } from "../services/seo";
import { productSeoSchema, storeSeoSchema } from "@/lib/seo";
import { toActionState, type ActionState } from "./util";

/** Store meta title/description, OG image and the white-label switch (Max only, enforced here). */
export async function saveStoreSeoAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { store, user } = await requireOwner();
    assertFeature(store, "seoAdvanced");
    const seo = storeSeoSchema.parse({ title: fd.get("title"), description: fd.get("description"), ogImageUrl: fd.get("ogImageUrl") });
    const whiteLabel = fd.get("whiteLabel") === "on";
    await updateStoreSeo(db(), store.id, seo, whiteLabel);
    await recordAudit(store.id, user.id, "store.seo", auditDetail([...Object.keys(seo), `whiteLabel:${whiteLabel}`]));
    invalidateStore(store.id, [store.slug]);
    revalidatePath("/dashboard/settings/seo");
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

/** Product-level meta title/description (Max only). */
export async function saveProductSeoAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { store } = await requireStore();
    assertFeature(store, "seoAdvanced");
    const id = z.uuid().parse(fd.get("productId"));
    const seo = productSeoSchema.parse({ title: fd.get("title"), description: fd.get("description") });
    await updateProductSeo(db(), store.id, id, seo);
    invalidateCatalog(store.id);
    revalidatePath(`/dashboard/products/${id}`);
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}
