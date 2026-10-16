/** Waitlist ranking: every friend who joins through your link moves you up this many spots… */
export const WAITLIST_REFERRAL_BOOST = 5;
/** …for at most this many friends (20 × 5 = 100 spots), so nobody can buy the front of the line. */
export const WAITLIST_MAX_BOOSTED_REFERRALS = 20;

/** Lower score = closer to the front. Ties go to whoever has more referrals, then to the earlier signup (seq). */
export function waitlistScore(seq: number, referrals: number): number {
  return seq - WAITLIST_REFERRAL_BOOST * Math.min(Math.max(referrals, 0), WAITLIST_MAX_BOOSTED_REFERRALS);
}

/** 1-based position of a signup among all signups (pure version of the SQL used by the service; used by tests). */
export function waitlistPosition(me: { seq: number; referrals: number }, all: { seq: number; referrals: number }[]): number {
  const mine = waitlistScore(me.seq, me.referrals);
  let ahead = 0;
  for (const o of all) {
    if (o.seq === me.seq) continue;
    const s = waitlistScore(o.seq, o.referrals);
    const ok = Math.min(o.referrals, WAITLIST_MAX_BOOSTED_REFERRALS);
    const mk = Math.min(me.referrals, WAITLIST_MAX_BOOSTED_REFERRALS);
    if (s < mine || (s === mine && (ok > mk || (ok === mk && o.seq < me.seq)))) ahead++;
  }
  return ahead + 1;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const REF_CODE_RE = /^[A-Z0-9]{6,12}$/;

/** 8-char code without look-alike characters (no 0/O, 1/I). `rand` returns bytes (default: Web Crypto). */
export function newRefCode(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return Array.from(rand(8), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export function normalizeRefCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim().toUpperCase();
  return REF_CODE_RE.test(c) ? c : null;
}

export function referralLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/?ref=${encodeURIComponent(code)}#join`;
}
