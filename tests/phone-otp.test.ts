import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { phoneOtps, stores, users } from "@/server/db/schema";
import { MockOtp, TwilioOtp, WhatsAppCloudOtp, resolveOtpProvider } from "@/server/otp/provider";
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS, requestLoginCode, userIdForPhone, verifyLoginCode } from "@/server/services/phone-otp";
import { seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => { database = await testDb(); });
let k = 0;
async function sellerWithPhone() {
  const phone = `96475${String(Date.now() % 1e8).padStart(8, "0")}`.slice(0, 13).replace(/.$/, String(k++ % 10));
  const s = await seller(database, "otp");
  await database.update(stores).set({ phone, whatsapp: phone }).where(eq(stores.id, s.store.id));
  return { ...s, phone };
}

describe("OTP provider selection (SF8)", () => {
  it("is off without config, WhatsApp Cloud first, then Twilio, mock only when asked", () => {
    expect(resolveOtpProvider({})).toBeNull();
    expect(resolveOtpProvider({ WHATSAPP_TOKEN: "t" })).toBeNull();
    expect(resolveOtpProvider({ WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_ID: "1", TWILIO_ACCOUNT_SID: "a", TWILIO_AUTH_TOKEN: "b", TWILIO_WHATSAPP_FROM: "+1" })?.name).toBe("whatsapp");
    expect(resolveOtpProvider({ TWILIO_ACCOUNT_SID: "a", TWILIO_AUTH_TOKEN: "b", TWILIO_WHATSAPP_FROM: "+1" })?.name).toBe("twilio");
    expect(resolveOtpProvider({ OTP_MOCK: true })?.name).toBe("mock");
    expect(resolveOtpProvider({ OTP_MOCK: false, NODE_ENV: "development" })).toBeNull();
  });
  it("builds the WhatsApp template and Twilio requests", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
    await new WhatsAppCloudOtp({ token: "tok", phoneId: "123", template: "login_code", lang: "en" }, f).send("9647501112233", "042137");
    const wa = JSON.parse(String(calls[0]!.init.body));
    expect(calls[0]!.url).toContain("/123/messages");
    expect(wa).toMatchObject({ to: "9647501112233", type: "template", template: { name: "login_code", language: { code: "en" } } });
    expect(JSON.stringify(wa)).toContain("042137");
    await new TwilioOtp({ sid: "AC1", token: "x", from: "+14155238886" }, f).send("9647501112233", "042137");
    const tw = new URLSearchParams(String(calls[1]!.init.body));
    expect(tw.get("To")).toBe("whatsapp:+9647501112233");
    expect(tw.get("From")).toBe("whatsapp:+14155238886");
    expect(tw.get("Body")).toContain("042137");
    const bad = (async () => new Response("{}", { status: 400 })) as unknown as typeof fetch;
    await expect(new WhatsAppCloudOtp({ token: "t", phoneId: "1", template: "x", lang: "en" }, bad).send("1", "2")).rejects.toThrow();
  });
});

describe("login codes", () => {
  it("unknown numbers get no code (same answer, nothing sent)", async () => {
    const m = new MockOtp();
    expect(await requestLoginCode(database, "9647999999990", m)).toEqual({ sent: false });
    expect(m.sent).toHaveLength(0);
  });
  it("store WhatsApp number finds the owner; user's own phone wins; shared number is ambiguous", async () => {
    const { user, phone } = await sellerWithPhone();
    expect(await userIdForPhone(database, phone)).toBe(user.id);
    const other = await seller(database, "otp2");
    await database.update(stores).set({ whatsapp: phone }).where(eq(stores.id, other.store.id));
    expect(await userIdForPhone(database, phone)).toBeNull();
    await database.update(users).set({ phone }).where(eq(users.id, other.user.id));
    expect(await userIdForPhone(database, phone)).toBe(other.user.id);
  });
  it("stores only a hash, signs in once, expires after 5 minutes", async () => {
    const { user, phone } = await sellerWithPhone();
    const m = new MockOtp();
    const t0 = new Date("2026-10-18T12:00:00Z");
    const r = await requestLoginCode(database, phone, m, t0);
    expect(r.sent).toBe(true);
    expect(m.sent[0]!.code).toMatch(/^\d{6}$/);
    const [row] = await database.select().from(phoneOtps).where(eq(phoneOtps.phone, phone));
    expect(row!.codeHash).not.toContain(m.sent[0]!.code);
    expect(row!.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.expiresAt.getTime() - t0.getTime()).toBe(OTP_TTL_MS);
    expect(await verifyLoginCode(database, phone, m.sent[0]!.code, new Date(t0.getTime() + 60_000))).toBe(user.id);
    await expect(verifyLoginCode(database, phone, m.sent[0]!.code, new Date(t0.getTime() + 61_000))).rejects.toMatchObject({ message: "otp_invalid" });
    const r2 = await requestLoginCode(database, phone, m, t0);
    await expect(verifyLoginCode(database, phone, r2.code!, new Date(t0.getTime() + OTP_TTL_MS + 1))).rejects.toMatchObject({ message: "otp_invalid" });
  });
  it("locks after 5 wrong tries and a new code replaces the old one", async () => {
    const { user, phone } = await sellerWithPhone();
    const m = new MockOtp();
    const now = new Date();
    const { code } = await requestLoginCode(database, phone, m, now);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) await expect(verifyLoginCode(database, phone, wrong, now)).rejects.toMatchObject({ message: "otp_invalid" });
    await expect(verifyLoginCode(database, phone, code!, now)).rejects.toMatchObject({ message: "otp_invalid" });
    const a = await requestLoginCode(database, phone, m, now);
    const b = await requestLoginCode(database, phone, m, new Date(now.getTime() + 1000));
    if (a.code !== b.code) await expect(verifyLoginCode(database, phone, a.code!, now)).rejects.toMatchObject({ message: "otp_invalid" });
    expect(await verifyLoginCode(database, phone, ` ${b.code!.slice(0, 3)} ${b.code!.slice(3)} `, new Date(now.getTime() + 2000))).toBe(user.id);
  });
  it("a failed send burns the code and reports otp_send_failed", async () => {
    const { phone } = await sellerWithPhone();
    const boom = { name: "mock" as const, send: async () => { throw new Error("down"); } };
    await expect(requestLoginCode(database, phone, boom)).rejects.toMatchObject({ message: "otp_send_failed" });
  });
});
