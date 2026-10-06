import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db";
import {
  authenticate,
  createSession,
  deleteSession,
  requestPasswordReset,
  resetPassword,
  signUp,
  validateSession,
} from "@/server/auth/service";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { ConsoleEmailProvider, setEmailProvider } from "@/server/email";
import { testDb } from "./support/db";

let database: Db;
const mail = new ConsoleEmailProvider();
beforeAll(async () => {
  database = await testDb();
  setEmailProvider(mail);
});

describe("passwords", () => {
  it("hashes with scrypt and verifies", async () => {
    const h = await hashPassword("hunter2hunter2");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("hunter2hunter2", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("sign up / log in / sessions", () => {
  it("signs up, rejects duplicate emails, authenticates", async () => {
    const u = await signUp(database, { name: "Ava", email: "ava@example.com", password: "password123", locale: "ku" });
    await expect(
      signUp(database, { name: "Ava2", email: "ava@example.com", password: "password123", locale: "ku" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await authenticate(database, "ava@example.com", "password123")).id).toBe(u.id);
    await expect(authenticate(database, "ava@example.com", "nope")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(authenticate(database, "ghost@example.com", "nope")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("creates, validates and destroys sessions (token stored hashed)", async () => {
    const u = await signUp(database, { name: "Bo", email: "bo@example.com", password: "password123", locale: "en" });
    const { token } = await createSession(database, u.id, 30);
    expect((await validateSession(database, token, 30))?.id).toBe(u.id);
    const rows = await database.query.sessions.findMany();
    expect(rows.some((r) => r.id === token)).toBe(false);
    await deleteSession(database, token);
    expect(await validateSession(database, token, 30)).toBeNull();
    expect(await validateSession(database, "bogus", 30)).toBeNull();
  });
});

describe("password reset", () => {
  it("emails a single-use link, resets the password and revokes sessions", async () => {
    const u = await signUp(database, { name: "Cy", email: "cy@example.com", password: "oldpassword", locale: "ar" });
    const { token: sessionToken } = await createSession(database, u.id, 30);
    await requestPasswordReset(database, "cy@example.com", "http://localhost:3000");
    const msg = mail.sent.at(-1)!;
    expect(msg.to).toBe("cy@example.com");
    const token = decodeURIComponent(/token=([^\s]+)/.exec(msg.text)![1]!);
    await resetPassword(database, token, "newpassword");
    await expect(authenticate(database, "cy@example.com", "oldpassword")).rejects.toBeTruthy();
    expect((await authenticate(database, "cy@example.com", "newpassword")).id).toBe(u.id);
    expect(await validateSession(database, sessionToken, 30)).toBeNull();
    await expect(resetPassword(database, token, "again12345")).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("does not reveal unknown emails", async () => {
    const before = mail.sent.length;
    await expect(requestPasswordReset(database, "nobody@example.com", "http://x")).resolves.toBeUndefined();
    expect(mail.sent.length).toBe(before);
  });
});

describe("rate limiting", () => {
  it("allows up to the limit within a window", async () => {
    const results = [];
    for (let i = 0; i < 6; i++) results.push((await hitRateLimit(database, "login:1.2.3.4", 5, 60)).allowed);
    expect(results).toEqual([true, true, true, true, true, false]);
    expect((await hitRateLimit(database, "login:5.6.7.8", 5, 60)).allowed).toBe(true);
  });
});
