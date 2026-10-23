import { z } from "zod";
import { env } from "../env";
import { logger } from "../logger";

/**
 * Transactional email behind one small interface. Which provider sends is decided by env only (plain fetch, no SDK):
 *   EMAIL_PROVIDER=resend + EMAIL_API_KEY (or RESEND_API_KEY)  → Resend HTTP API (free 3,000/month)
 *   EMAIL_PROVIDER=brevo  + EMAIL_API_KEY (or BREVO_API_KEY)   → Brevo HTTP API (free 300/day)
 *   anything else (or a missing key)                           → console: the mail is written to the server log
 * EMAIL_DRIVER is the older name of EMAIL_PROVIDER and still works; EMAIL_FROM is the sender ("Name <addr@domain>").
 * Callers never know which one is active; a provider failure throws so the caller decides (password reset logs and
 * carries on, so the endpoint never reveals whether an account exists).
 */
export const emailMessageSchema = z.object({
  to: z.email().max(254),
  subject: z.string().trim().min(1).max(200),
  text: z.string().min(1).max(50_000),
  html: z.string().max(200_000).optional(),
});
export type EmailMessage = z.infer<typeof emailMessageSchema>;

export interface EmailProvider {
  readonly name: string;
  send(msg: EmailMessage): Promise<void>;
}

const SEND_TIMEOUT_MS = 10_000;

/** "Bazarga <hello@x.app>" → { name, email }; a bare address → { email }. */
export function parseFrom(from: string): { name?: string; email: string } {
  const m = /^\s*(.*?)\s*<\s*([^>\s]+)\s*>\s*$/.exec(from);
  if (m) return m[1] ? { name: m[1].replace(/^"|"$/g, ""), email: m[2]! } : { email: m[2]! };
  return { email: from.trim() };
}

async function postJson(url: string, headers: Record<string, string>, body: unknown, provider: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!res.ok) {
    // The body can echo the recipient; keep only the status + a short excerpt.
    const excerpt = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`${provider} send failed: ${res.status} ${excerpt}`);
  }
}

/** Dev / fallback adapter: prints the email (incl. reset links) to the server log. */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  readonly sent: EmailMessage[] = [];
  async send(msg: EmailMessage) {
    const m = emailMessageSchema.parse(msg);
    this.sent.push(m);
    logger.info("email.console", { to: m.to, subject: m.subject, text: m.text });
  }
}

/** Resend (https://resend.com) HTTP API adapter. */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  constructor(
    private apiKey: string,
    private from: string,
  ) {}
  async send(msg: EmailMessage) {
    const m = emailMessageSchema.parse(msg);
    await postJson(
      "https://api.resend.com/emails",
      { Authorization: `Bearer ${this.apiKey}` },
      { from: this.from, to: [m.to], subject: m.subject, text: m.text, html: m.html },
      "resend",
    );
  }
}

/** Brevo (https://brevo.com, formerly Sendinblue) transactional HTTP API adapter. */
export class BrevoEmailProvider implements EmailProvider {
  readonly name = "brevo";
  constructor(
    private apiKey: string,
    private from: string,
  ) {}
  async send(msg: EmailMessage) {
    const m = emailMessageSchema.parse(msg);
    await postJson(
      "https://api.brevo.com/v3/smtp/email",
      { "api-key": this.apiKey },
      { sender: parseFrom(this.from), to: [{ email: m.to }], subject: m.subject, textContent: m.text, ...(m.html ? { htmlContent: m.html } : {}) },
      "brevo",
    );
  }
}

type EmailEnv = {
  EMAIL_PROVIDER?: string;
  EMAIL_DRIVER?: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM: string;
  RESEND_API_KEY?: string;
  BREVO_API_KEY?: string;
};

/** Which provider env asks for and whether its key is present (pure; also used by /api/health). */
export function resolveEmailConfig(e: EmailEnv): { wanted: string; driver: "console" | "resend" | "brevo"; key?: string } {
  const wanted = e.EMAIL_PROVIDER || e.EMAIL_DRIVER || "console";
  const key = wanted === "resend" ? e.RESEND_API_KEY || e.EMAIL_API_KEY : wanted === "brevo" ? e.BREVO_API_KEY || e.EMAIL_API_KEY : undefined;
  if ((wanted === "resend" || wanted === "brevo") && key) return { wanted, driver: wanted, key };
  return { wanted, driver: "console" };
}

/** Pure selection (tested): the configured provider when its key is present, else console. */
export function selectEmailProvider(e: EmailEnv): EmailProvider {
  const c = resolveEmailConfig(e);
  if (c.driver === "resend") return new ResendEmailProvider(c.key!, e.EMAIL_FROM);
  if (c.driver === "brevo") return new BrevoEmailProvider(c.key!, e.EMAIL_FROM);
  if (c.wanted !== "console") logger.warn("email.provider_key_missing", { driver: c.wanted, fallback: "console" });
  return new ConsoleEmailProvider();
}

let provider: EmailProvider | undefined;
export function emailProvider(): EmailProvider {
  if (!provider) provider = selectEmailProvider(env());
  return provider;
}
export function setEmailProvider(p: EmailProvider | undefined) {
  provider = p;
}

/** True when mail actually leaves the server (a provider with its key). Console = mail only reaches the log. */
export function emailDelivers(e: EmailEnv = env()): boolean {
  return resolveEmailConfig(e).driver !== "console";
}
