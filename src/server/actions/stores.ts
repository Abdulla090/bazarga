"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "../db";
import { env } from "../env";
import { requireUser } from "../auth/session";
import { recordAudit } from "../audit";
import { invalidateStore } from "../cache/tags";
import { CURRENT_STORE_COOKIE, createAdditionalStore, listAccessibleStores } from "../services/store-access";
import { storeInputFromForm } from "./store-input";
import { toActionState, type ActionState } from "./util";

async function setCurrentStore(id: string) {
  (await cookies()).set(CURRENT_STORE_COOKIE, id, { httpOnly: true, secure: env().NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

/** Switch the dashboard to another store the user can access (owned or joined). A plain form POST: works without JS. */
export async function switchStoreAction(fd: FormData): Promise<void> {
  const user = await requireUser();
  const id = z.uuid().safeParse(fd.get("storeId"));
  if (id.success && (await listAccessibleStores(db(), user.id)).some((a) => a.store.id === id.data)) await setCurrentStore(id.data);
  redirect("/dashboard");
}

/** Add another store to the account (Business 3 / Max 5, enforced in createAdditionalStore), then switch to it. */
export async function createAnotherStoreAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    const user = await requireUser();
    const created = await createAdditionalStore(db(), user.id, storeInputFromForm(fd));
    invalidateStore(created.id, [created.slug]);
    await recordAudit(created.id, user.id, "store.create");
    await setCurrentStore(created.id);
    id = created.id;
  } catch (e) {
    return toActionState(e);
  }
  redirect(`/dashboard?new=${id}`);
}
