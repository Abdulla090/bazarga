import { randomInt } from "node:crypto";
import { logger } from "../logger";
import { sha256 } from "../auth/tokens";

/**
 * Phone / WhatsApp one-time-password provider.
 * v1 ships the console stub only; email+password is the live sign-in method.
 * TODO(roadmap): WhatsAppOtpProvider using an approved WhatsApp Cloud API *authentication template*,
 * persisted codes (hashed) with attempt counters, and per-phone rate limits.
 */
export interface OtpProvider {
  readonly name: string;
  send(phone: string): Promise<{ expiresAt: Date }>;
  verify(phone: string, code: string): Promise<boolean>;
}

export class ConsoleOtpProvider implements OtpProvider {
  readonly name = "console";
  private codes = new Map<string, { hash: string; expiresAt: Date; attempts: number }>();

  async send(phone: string) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    this.codes.set(phone, { hash: sha256(code), expiresAt, attempts: 0 });
    logger.info("otp.console", { phone, code });
    return { expiresAt };
  }

  async verify(phone: string, code: string) {
    const entry = this.codes.get(phone);
    if (!entry || entry.expiresAt < new Date() || entry.attempts >= 5) return false;
    entry.attempts++;
    const ok = entry.hash === sha256(code);
    if (ok) this.codes.delete(phone);
    return ok;
  }
}

let provider: OtpProvider | undefined;
export const otpProvider = () => (provider ??= new ConsoleOtpProvider());
