"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../db";
import { env } from "../env";
import { requireOwner, requireUser } from "../auth/session";
import { recordAudit } from "../audit";
import { emailProvider, resolveEmailConfig } from "../email";
import { logger } from "../logger";
import { CURRENT_STORE_COOKIE } from "../services/store-access";
import { acceptInvite, inviteMember, removeMember } from "../services/team";
import { assertFeature } from "../plan-gate";
import { inviteMail } from "../email/team-mail";
import { toActionState, type ActionState } from "./util";

/** Owner invites a staff member. Emails the link when an email provider is configured; always returns it for copying. */
export async function inviteMemberAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { store, user } = await requireOwner();
    assertFeature(store, "team");
    const inv = await inviteMember(db(), store.id, user.id, String(fd.get("email") ?? ""));
    const link = `${env().APP_URL.replace(/\/$/, "")}/invite/${inv.token}`;
    let emailed = false;
    if (resolveEmailConfig(env()).driver !== "console") {
      try {
        await emailProvider().send({ to: inv.email, ...inviteMail(store.defaultLocale, store.name, user.name, link) });
        emailed = true;
      } catch (err) {
        logger.error("team.invite_email_failed", { err });
      }
    }
    await recordAudit(store.id, user.id, "team.invite");
    revalidatePath("/dashboard/team");
    return { ok: true, data: { link, emailed, email: inv.email } };
  } catch (e) {
    return toActionState(e);
  }
}

export async function removeMemberAction(fd: FormData): Promise<void> {
  const { store, user } = await requireOwner();
  const id = z.uuid().parse(fd.get("memberId"));
  await removeMember(db(), store.id, id);
  await recordAudit(store.id, user.id, "team.remove");
  revalidatePath("/dashboard/team");
  redirect("/dashboard/team");
}

/** Signed-in invitee accepts; the dashboard then opens the store they joined. */
export async function acceptInviteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let storeId: string;
  try {
    const user = await requireUser();
    const r = await acceptInvite(db(), String(fd.get("token") ?? ""), user);
    storeId = r.storeId;
    await recordAudit(storeId, user.id, "team.join");
    (await cookies()).set(CURRENT_STORE_COOKIE, storeId, { httpOnly: true, secure: env().NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  } catch (e) {
    return toActionState(e);
  }
  redirect("/dashboard");
}
