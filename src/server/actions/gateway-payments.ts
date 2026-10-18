"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "../db";
import { env } from "../env";
import { logger } from "../logger";
import { recordAudit } from "../audit";
import { requireOwner } from "../auth/session";
import { requireAdmin } from "../auth/admin";
import { enforceRateLimit } from "../auth/rate-limit";
import { invalidateStore } from "../cache/tags";
import { gateway } from "../payments/gateway/registry";
import {
  createPayout,
  markPayoutPaid,
  reviewPayoutProfile,
  savePayoutProfile,
  setOnlinePayments,
  startSubscriptionCheckout,
} from "../payments/gateway/service";
import { toActionState, type ActionState } from "./util";

/** Seller: save payout details (tenant = session store). Any change goes back to review. */
export async function savePayoutProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { store, user } = await requireOwner();
    await enforceRateLimit(db(), `payout-profile:${store.id}`, 10, 3600);
    await savePayoutProfile(db(), store.id, {
      method: formData.get("method"),
      accountName: formData.get("accountName"),
      accountIdentifier: formData.get("accountIdentifier"),
    });
    await recordAudit(store.id, user.id, "payout.profile", "method,accountName,accountIdentifier");
    invalidateStore(store.id);
    revalidatePath("/dashboard/payments");
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

/** Seller: storefront "online payments" toggle (only when gateway on + payouts verified). */
export async function setOnlinePaymentsAction(enabled: boolean): Promise<ActionState> {
  try {
    const { store, user } = await requireOwner();
    await setOnlinePayments(db(), store.id, z.boolean().parse(enabled));
    await recordAudit(store.id, user.id, "payment.toggle", `online:${enabled ? "on" : "off"}`);
    invalidateStore(store.id);
    revalidatePath("/dashboard/payments");
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

/** Seller: "Pay online" on /dashboard/upgrade (form post, works without client JS) → hosted checkout. */
export async function payOnlineForm(formData: FormData): Promise<void> {
  const { store } = await requireOwner();
  if (!gateway()) redirect("/dashboard/upgrade");
  let url: string;
  try {
    await enforceRateLimit(db(), `paysub:${store.id}`, 10, 600);
    const r = await startSubscriptionCheckout(db(), store.id, { plan: formData.get("plan"), months: formData.get("months") }, env().APP_URL);
    url = r.url;
  } catch (err) {
    logger.warn("gateway.pay_online_failed", { storeId: store.id, err });
    redirect("/dashboard/upgrade?pay=error");
  }
  redirect(url);
}

// ---------------------------------------------------------------- admin (requireAdmin → 404 for everyone else)
const idSchema = z.uuid();

export async function reviewPayoutProfileAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const decision = formData.get("decision") === "verified" ? "verified" : "rejected";
  await reviewPayoutProfile(db(), idSchema.parse(formData.get("storeId")), decision);
  revalidatePath("/admin");
}

export async function createPayoutAction(formData: FormData): Promise<void> {
  await requireAdmin();
  try {
    await createPayout(db(), idSchema.parse(formData.get("storeId")));
  } catch (err) {
    logger.warn("admin.create_payout_failed", { err });
  }
  revalidatePath("/admin");
}

export async function markPayoutPaidAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const ref = String(formData.get("reference") ?? "").trim().slice(0, 120) || null;
  await markPayoutPaid(db(), idSchema.parse(formData.get("id")), ref);
  revalidatePath("/admin");
}
