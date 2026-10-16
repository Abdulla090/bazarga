"use server";
import { headers } from "next/headers";
import { db } from "../db";
import { waitlistSchema } from "@/lib/validation";
import { joinWaitlist } from "../services/waitlist";
import { enforceRateLimit } from "../auth/rate-limit";
import { formObject, toActionState, type ActionState } from "./util";
import { logger } from "../logger";

export async function joinWaitlistAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const ip = ((await headers()).get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
    await enforceRateLimit(db(), `waitlist:${ip}`, 10, 3600);
    const input = waitlistSchema.parse(formObject(fd));
    const r = await joinWaitlist(db(), input, formObject(fd).ref);
    logger.info("waitlist.joined", { city: input.city, sells: input.sells, existing: r.existing, referred: Boolean(formObject(fd).ref) });
    return { ok: true, message: input.name.split(/\s+/)[0] ?? input.name, data: { code: r.refCode, position: r.position, total: r.total, referrals: r.referrals, existing: r.existing } };
  } catch (e) {
    return toActionState(e);
  }
}
