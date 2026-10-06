import { env } from "../env";
import { logger } from "../logger";

export type EmailMessage = { to: string; subject: string; text: string; html?: string };

export interface EmailProvider {
  readonly name: string;
  send(msg: EmailMessage): Promise<void>;
}

/** Dev adapter: prints the email (incl. reset links) to the server log. */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  readonly sent: EmailMessage[] = [];
  async send(msg: EmailMessage) {
    this.sent.push(msg);
    logger.info("email.console", { to: msg.to, subject: msg.subject, text: msg.text });
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
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
    });
    if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
  }
}

let provider: EmailProvider | undefined;
export function emailProvider(): EmailProvider {
  if (!provider) {
    const e = env();
    provider =
      e.EMAIL_DRIVER === "resend" && e.RESEND_API_KEY
        ? new ResendEmailProvider(e.RESEND_API_KEY, e.EMAIL_FROM)
        : new ConsoleEmailProvider();
  }
  return provider;
}
export function setEmailProvider(p: EmailProvider | undefined) {
  provider = p;
}
