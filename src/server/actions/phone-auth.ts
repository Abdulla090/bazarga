"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "../db";
import { env } from "../env";
import { enforceRateLimit } from "../auth/rate-limit";
import { clientIp, startSession } from "../auth/session";
import { resolveOtpProvider } from "../otp/provider";
import { requestLoginCode, verifyLoginCode } from "../services/phone-otp";
import { normalizePhone } from "@/lib/phone";
import { safeInviteNext } from "@/lib/team";
import { formObject, toActionState, type ActionState } from "./util";
import { AppError } from "../errors";

const phoneIn = z.object({ phone: z.string().max(40).transform((v, ctx) => normalizePhone(v) ?? (ctx.addIssue({ code: "custom", message: "invalid_phone" }), z.NEVER)) });
const codeIn = phoneIn.extend({ code: z.string().max(12) });

function provider() {
  const p = resolveOtpProvider(env());
  if (!p) throw new AppError("NOT_FOUND");
  return p;
}

/** Step 1: send a 6-digit code on WhatsApp. Same answer whether or not the number has an account. */
export async function sendLoginCodeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const p = provider();
    const ip = await clientIp();
    const { phone } = phoneIn.parse(formObject(fd));
    await Promise.all([
      enforceRateLimit(db(), `otp:send:ip:${ip}`, 10, 3600),
      enforceRateLimit(db(), `otp:send:phone:${phone}`, 3, 600),
    ]);
    const r = await requestLoginCode(db(), phone, p);
    // The dev mock shows the code on screen (never in production, never for real providers).
    const devCode = p.name === "mock" && env().NODE_ENV !== "production" && r.code ? r.code : "";
    return { ok: true, data: { phone, devCode } };
  } catch (e) {
    return toActionState(e);
  }
}

/** Step 2: check the code and start the session. */
export async function verifyLoginCodeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const next = safeInviteNext(fd.get("next"));
  try {
    provider();
    const ip = await clientIp();
    const { phone, code } = codeIn.parse(formObject(fd));
    await enforceRateLimit(db(), `otp:verify:ip:${ip}`, 20, 3600);
    const userId = await verifyLoginCode(db(), phone, code);
    await startSession(userId);
  } catch (e) {
    return toActionState(e);
  }
  redirect(next ?? "/dashboard");
}
