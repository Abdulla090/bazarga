import { beforeAll, describe, expect, it } from "vitest";
import { testDb } from "./support/db";
import type { Db } from "@/server/db";
import { joinWaitlist, waitlistStatus, waitlistTotal } from "@/server/services/waitlist";
import { WAITLIST_MAX_BOOSTED_REFERRALS, WAITLIST_REFERRAL_BOOST, newRefCode, normalizeRefCode, referralLink, waitlistPosition, waitlistScore } from "@/lib/waitlist";
import { waitlistSchema } from "@/lib/validation";

let db: Db;
let n = 0;
const person = (name = "Dilan") => {
  n++;
  return waitlistSchema.parse({ name: `${name} ${n}`, whatsapp: `07501${String(100000 + n)}`, sells: "c1", city: "erbil", locale: "ku" });
};

beforeAll(async () => {
  db = await testDb();
});

describe("waitlist ranking (pure)", () => {
  it("moves up by the boost per referral and caps at 20 friends", () => {
    expect(waitlistScore(100, 0)).toBe(100);
    expect(waitlistScore(100, 2)).toBe(100 - 2 * WAITLIST_REFERRAL_BOOST);
    expect(waitlistScore(1000, 99)).toBe(1000 - WAITLIST_MAX_BOOSTED_REFERRALS * WAITLIST_REFERRAL_BOOST);
    expect(waitlistScore(10, -3)).toBe(10);
  });
  it("breaks ties by referrals, then join order, and counts only people ahead", () => {
    const all = [{ seq: 1, referrals: 0 }, { seq: 2, referrals: 0 }, { seq: 12, referrals: 2 }];
    expect(waitlistPosition(all[0]!, all)).toBe(1);
    expect(waitlistPosition(all[1]!, all)).toBe(3); // seq 12 with 2 friends ties on score 2 and wins on referrals
    expect(waitlistPosition(all[2]!, all)).toBe(2);
    expect(waitlistPosition({ seq: 12, referrals: 3 }, all)).toBe(1);
  });
  it("one friend moves you up exactly the boost, even through a tie", () => {
    const all = Array.from({ length: 20 }, (_, i) => ({ seq: i + 1, referrals: 0 }));
    const before = waitlistPosition({ seq: 20, referrals: 0 }, all);
    const after = waitlistPosition({ seq: 20, referrals: 1 }, all);
    expect(before - after).toBe(WAITLIST_REFERRAL_BOOST);
  });
});

describe("referral codes", () => {
  it("are 8 chars with no look-alikes and normalise safely", () => {
    for (let i = 0; i < 50; i++) expect(newRefCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(normalizeRefCode(" ab3d5fgh ")).toBe("AB3D5FGH");
    expect(normalizeRefCode("x")).toBeNull();
    expect(normalizeRefCode("<script>")).toBeNull();
    expect(normalizeRefCode(undefined)).toBeNull();
  });
  it("builds the share link", () => {
    expect(referralLink("https://bazarga.vercel.app/", "ABC23456")).toBe("https://bazarga.vercel.app/?ref=ABC23456#join");
  });
});

describe("joinWaitlist", () => {
  it("assigns increasing positions and a unique code", async () => {
    const a = await joinWaitlist(db, person());
    const b = await joinWaitlist(db, person());
    expect(a.existing).toBe(false);
    expect(b.position).toBe(a.position + 1);
    expect(b.refCode).not.toBe(a.refCode);
    expect(b.total).toBeGreaterThanOrEqual(2);
  });

  it("returns the same spot for the same WhatsApp number, with no second row", async () => {
    const p = person();
    const first = await joinWaitlist(db, p);
    const before = await waitlistTotal(db);
    const again = await joinWaitlist(db, { ...p, name: "Someone else" });
    expect(again.existing).toBe(true);
    expect(again.refCode).toBe(first.refCode);
    expect(await waitlistTotal(db)).toBe(before);
  });

  it("moves the referrer up when a friend joins through their link", async () => {
    const early = await joinWaitlist(db, person("early"));
    for (let i = 0; i < 6; i++) await joinWaitlist(db, person("filler"));
    const me = await joinWaitlist(db, person("me"));
    const before = (await waitlistStatus(db, me.refCode))!.position;
    await joinWaitlist(db, person("friend"), me.refCode);
    const after = await waitlistStatus(db, me.refCode);
    expect(after!.referrals).toBe(1);
    expect(after!.position).toBe(Math.max(1, before - WAITLIST_REFERRAL_BOOST));
    expect(after!.position).toBeGreaterThan((await waitlistStatus(db, early.refCode))!.position);
  });

  it("ignores unknown codes and gives no credit for repeat numbers", async () => {
    const r = await joinWaitlist(db, person(), "ZZZZZZZZ");
    expect(r.existing).toBe(false);
    const host = await joinWaitlist(db, person("host"));
    const friend = person("friend");
    await joinWaitlist(db, friend, host.refCode);
    await joinWaitlist(db, friend, host.refCode);
    expect((await waitlistStatus(db, host.refCode))!.referrals).toBe(1);
  });

  it("status is null for unknown or malformed codes", async () => {
    expect(await waitlistStatus(db, "NOPE")).toBeNull();
    expect(await waitlistStatus(db, "QQQQQQQQ")).toBeNull();
  });
});
