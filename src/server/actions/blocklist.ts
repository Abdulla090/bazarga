"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../db";
import { requireStore } from "../auth/session";
import { blockPhone, unblockPhone } from "../services/blocklist";
import { toActionState, type ActionState } from "./util";

const phoneField = z.string().trim().min(1).max(24);
const noteField = z.string().trim().max(200).optional();
const orderIdField = z.uuid().optional();

function revalidate(orderId?: string) {
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/orders");
  if (orderId) revalidatePath(`/dashboard/orders/${orderId}`);
}

/** Block a shopper phone for the seller's own store (store id from the session only). */
export async function blockPhoneAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { store } = await requireStore();
    const phone = phoneField.parse(fd.get("phone"));
    const note = noteField.parse(fd.get("note") ?? undefined);
    const orderId = orderIdField.parse(fd.get("orderId") || undefined);
    await blockPhone(db(), store.id, phone, note);
    revalidate(orderId);
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

export async function unblockPhoneAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { store } = await requireStore();
    const phone = phoneField.parse(fd.get("phone"));
    const orderId = orderIdField.parse(fd.get("orderId") || undefined);
    await unblockPhone(db(), store.id, phone);
    revalidate(orderId);
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}
