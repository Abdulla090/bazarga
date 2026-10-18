import "server-only";
import { logger } from "../logger";

/**
 * Sign in with WhatsApp (SF8): who delivers the one-time code. Env-gated; no provider → the option is hidden.
 *   WhatsApp Cloud API (Meta)  WHATSAPP_TOKEN + WHATSAPP_PHONE_ID (+ WHATSAPP_TEMPLATE / WHATSAPP_TEMPLATE_LANG)
 *   Twilio (WhatsApp sender)   TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM
 *   Mock (dev)                 OTP_MOCK=true: the code goes to the server log (and the screen outside production)
 * Phones are international digits without "+" (src/lib/phone.ts normalizePhone), e.g. 9647501234567.
 */
export interface OtpProvider {
  readonly name: "whatsapp" | "twilio" | "mock";
  send(phone: string, code: string): Promise<void>;
}

export type OtpEnv = {
  NODE_ENV?: string;
  WHATSAPP_TOKEN?: string; WHATSAPP_PHONE_ID?: string; WHATSAPP_TEMPLATE?: string; WHATSAPP_TEMPLATE_LANG?: string;
  TWILIO_ACCOUNT_SID?: string; TWILIO_AUTH_TOKEN?: string; TWILIO_WHATSAPP_FROM?: string;
  OTP_MOCK?: boolean;
};

export class WhatsAppCloudOtp implements OtpProvider {
  readonly name = "whatsapp" as const;
  constructor(private c: { token: string; phoneId: string; template: string; lang: string }, private f: typeof fetch = fetch) {}
  async send(phone: string, code: string) {
    // Authentication templates take the code as the body parameter and as the copy-code button parameter.
    const res = await this.f(`https://graph.facebook.com/v21.0/${encodeURIComponent(this.c.phoneId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: this.c.template,
          language: { code: this.c.lang },
          components: [
            { type: "body", parameters: [{ type: "text", text: code }] },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
          ],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { code?: number } };
      logger.warn("otp.whatsapp_failed", { status: res.status, code: body.error?.code });
      throw new Error("otp_send_failed");
    }
  }
}

export class TwilioOtp implements OtpProvider {
  readonly name = "twilio" as const;
  constructor(private c: { sid: string; token: string; from: string }, private f: typeof fetch = fetch) {}
  async send(phone: string, code: string) {
    const from = this.c.from.startsWith("whatsapp:") ? this.c.from : `whatsapp:${this.c.from}`;
    const body = new URLSearchParams({ From: from, To: `whatsapp:+${phone}`, Body: `${code} is your Reelcart login code. It expires in 5 minutes. Don't share it.` });
    const res = await this.f(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.c.sid)}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${this.c.sid}:${this.c.token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      logger.warn("otp.twilio_failed", { status: res.status });
      throw new Error("otp_send_failed");
    }
  }
}

export class MockOtp implements OtpProvider {
  readonly name = "mock" as const;
  readonly sent: { phone: string; code: string }[] = [];
  async send(phone: string, code: string) {
    this.sent.push({ phone, code });
    logger.info("otp.mock_code", { phone: `…${phone.slice(-4)}`, code });
  }
}

/** The configured provider, or null (feature hidden). WhatsApp Cloud wins over Twilio; mock only with OTP_MOCK. */
export function resolveOtpProvider(e: OtpEnv): OtpProvider | null {
  if (e.WHATSAPP_TOKEN && e.WHATSAPP_PHONE_ID) {
    return new WhatsAppCloudOtp({ token: e.WHATSAPP_TOKEN, phoneId: e.WHATSAPP_PHONE_ID, template: e.WHATSAPP_TEMPLATE || "login_code", lang: e.WHATSAPP_TEMPLATE_LANG || "en" });
  }
  if (e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN && e.TWILIO_WHATSAPP_FROM) {
    return new TwilioOtp({ sid: e.TWILIO_ACCOUNT_SID, token: e.TWILIO_AUTH_TOKEN, from: e.TWILIO_WHATSAPP_FROM });
  }
  if (e.OTP_MOCK) return new MockOtp();
  return null;
}
