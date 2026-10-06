"use server";
import { redirect } from "next/navigation";
import { db } from "../db";
import { env } from "../env";
import { enforceRateLimit } from "../auth/rate-limit";
import { authenticate, requestPasswordReset, resetPassword, signUp } from "../auth/service";
import { clientIp, endSession, startSession } from "../auth/session";
import { forgotPasswordSchema, logInSchema, resetPasswordSchema, signUpSchema } from "@/lib/validation";
import { formObject, toActionState, type ActionState } from "./util";
import { logger } from "../logger";

// Rate limits: per IP and per email, fixed windows.
const LIMITS = { login: [10, 300], signup: [5, 3600], forgot: [5, 3600], reset: [10, 3600] } as const;

export async function signUpAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const ip = await clientIp();
    await enforceRateLimit(db(), `signup:ip:${ip}`, ...LIMITS.signup);
    const input = signUpSchema.parse(formObject(fd));
    const user = await signUp(db(), input);
    await startSession(user.id);
    logger.info("auth.signup", { userId: user.id });
  } catch (e) {
    return toActionState(e);
  }
  redirect("/onboarding");
}

export async function logInAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const ip = await clientIp();
    const input = logInSchema.parse(formObject(fd));
    await enforceRateLimit(db(), `login:ip:${ip}`, ...LIMITS.login);
    await enforceRateLimit(db(), `login:email:${input.email}`, ...LIMITS.login);
    const user = await authenticate(db(), input.email, input.password);
    await startSession(user.id);
  } catch (e) {
    return toActionState(e);
  }
  redirect("/dashboard");
}

export async function logOutAction() {
  await endSession();
  redirect("/");
}

export async function forgotPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const ip = await clientIp();
    await enforceRateLimit(db(), `forgot:ip:${ip}`, ...LIMITS.forgot);
    const { email } = forgotPasswordSchema.parse(formObject(fd));
    await enforceRateLimit(db(), `forgot:email:${email}`, ...LIMITS.forgot);
    await requestPasswordReset(db(), email, env().APP_URL);
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

export async function resetPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const ip = await clientIp();
    await enforceRateLimit(db(), `reset:ip:${ip}`, ...LIMITS.reset);
    const { token, password } = resetPasswordSchema.parse(formObject(fd));
    await resetPassword(db(), token, password);
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}
