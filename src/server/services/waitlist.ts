import { count, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Db } from "../db";
import { waitlist } from "../db/schema";
import type { waitlistSchema } from "@/lib/validation";
import { WAITLIST_MAX_BOOSTED_REFERRALS, WAITLIST_REFERRAL_BOOST, newRefCode, normalizeRefCode } from "@/lib/waitlist";

export type WaitlistStatus = {
  refCode: string;
  position: number;
  total: number;
  referrals: number;
};

const boosted = sql`least(${waitlist.referralCount}, ${WAITLIST_MAX_BOOSTED_REFERRALS})`;
const score = sql`(${waitlist.seq} - ${WAITLIST_REFERRAL_BOOST} * ${boosted})`;

/** Position (1-based) and totals for one signup; null when the code is unknown. */
export async function waitlistStatus(database: Db, refCode: string): Promise<(WaitlistStatus & { firstName: string }) | null> {
  const code = normalizeRefCode(refCode);
  if (!code) return null;
  const [me] = await database
    .select({ id: waitlist.id, name: waitlist.name, seq: waitlist.seq, refCode: waitlist.refCode, referrals: waitlist.referralCount })
    .from(waitlist)
    .where(eq(waitlist.refCode, code))
    .limit(1);
  if (!me || me.seq === null) return null;
  const myBoost = Math.min(me.referrals, WAITLIST_MAX_BOOSTED_REFERRALS);
  const mine = me.seq - WAITLIST_REFERRAL_BOOST * myBoost;
  const [ahead] = await database
    .select({ n: count() })
    .from(waitlist)
    .where(
      sql`(${score} < ${mine} or (${score} = ${mine} and (${boosted} > ${myBoost} or (${boosted} = ${myBoost} and ${waitlist.seq} < ${me.seq})))) and ${waitlist.id} <> ${me.id}`,
    );
  const [total] = await database.select({ n: count() }).from(waitlist);
  return {
    refCode: me.refCode,
    position: (ahead?.n ?? 0) + 1,
    total: total?.n ?? 0,
    referrals: me.referrals,
    firstName: me.name.split(/\s+/)[0] ?? me.name,
  };
}

/** Public total (real count, never padded). */
export async function waitlistTotal(database: Db): Promise<number> {
  const [r] = await database.select({ n: count() }).from(waitlist);
  return r?.n ?? 0;
}

/**
 * Join the waitlist. The same WhatsApp number twice returns the existing spot (no second row, no second referral credit).
 * `ref` is the code of the person whose link was used; unknown codes are ignored.
 */
export async function joinWaitlist(
  database: Db,
  input: z.infer<typeof waitlistSchema>,
  ref?: string | null,
): Promise<WaitlistStatus & { existing: boolean }> {
  const [dupe] = await database
    .select({ refCode: waitlist.refCode })
    .from(waitlist)
    .where(eq(waitlist.whatsapp, input.whatsapp))
    .limit(1);
  if (dupe) {
    const s = await waitlistStatus(database, dupe.refCode);
    if (s) return { ...s, existing: true };
  }

  const refCodeIn = normalizeRefCode(ref);
  const [referrer] = refCodeIn
    ? await database.select({ id: waitlist.id }).from(waitlist).where(eq(waitlist.refCode, refCodeIn)).limit(1)
    : [];

  let code = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    code = newRefCode();
    const [taken] = await database.select({ id: waitlist.id }).from(waitlist).where(eq(waitlist.refCode, code)).limit(1);
    if (!taken) break;
  }
  await database.transaction(async (tx) => {
    await tx.insert(waitlist).values({ ...input, refCode: code, referredBy: referrer?.id ?? null });
    if (referrer) {
      await tx
        .update(waitlist)
        .set({ referralCount: sql`${waitlist.referralCount} + 1` })
        .where(eq(waitlist.id, referrer.id));
    }
  });
  const s = await waitlistStatus(database, code);
  if (!s) throw new Error("waitlist: row vanished after insert");
  return { ...s, existing: false };
}
