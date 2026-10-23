import { describe, expect, it } from "vitest";
import { emailDelivers } from "@/server/email";
import en from "../messages/en.json";
import ku from "../messages/ku.json";
import ar from "../messages/ar.json";
import kmr from "../messages/kmr.json";

const FROM = "Reelcart <hello@example.com>";

describe("email reality: no flow pretends a mail went out while EMAIL_PROVIDER is console", () => {
  it("console (unset, explicit, or a provider without its key) does not deliver", () => {
    expect(emailDelivers({ EMAIL_FROM: FROM })).toBe(false);
    expect(emailDelivers({ EMAIL_FROM: FROM, EMAIL_PROVIDER: "console" })).toBe(false);
    expect(emailDelivers({ EMAIL_FROM: FROM, EMAIL_PROVIDER: "resend" })).toBe(false);
    expect(emailDelivers({ EMAIL_FROM: FROM, EMAIL_PROVIDER: "brevo" })).toBe(false);
  });

  it("switches back automatically once EMAIL_PROVIDER + a key are set", () => {
    expect(emailDelivers({ EMAIL_FROM: FROM, EMAIL_PROVIDER: "resend", EMAIL_API_KEY: "re_x" })).toBe(true);
    expect(emailDelivers({ EMAIL_FROM: FROM, EMAIL_PROVIDER: "brevo", EMAIL_API_KEY: "xkeysib" })).toBe(true);
    expect(emailDelivers({ EMAIL_FROM: FROM, EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_x" })).toBe(true);
  });

  it("the honest forgot-password copy exists in all four locales", () => {
    for (const m of [en, ku, ar, kmr]) {
      expect(m.auth.forgotNoEmail.length).toBeGreaterThan(20);
      expect(m.auth.forgotNoEmailHint.length).toBeGreaterThan(5);
    }
  });
});
