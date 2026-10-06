import { env } from "../env";
import { logger } from "../logger";
import { emailProvider } from "../email";

export type Notification = {
  kind: "order.created" | "order.paid";
  /** Recipient hints; each channel picks what it understands. */
  to: { whatsapp?: string | null; telegramChatId?: string | null; email?: string | null };
  title: string;
  body: string;
  link?: string;
};

export interface Notifier {
  readonly name: string;
  send(n: Notification): Promise<void>;
}

export class ConsoleNotifier implements Notifier {
  readonly name = "console";
  readonly sent: Notification[] = [];
  async send(n: Notification) {
    this.sent.push(n);
    logger.info("notify.console", { kind: n.kind, to: n.to, title: n.title, body: n.body, link: n.link });
  }
}

/** Telegram Bot API sendMessage. */
export class TelegramNotifier implements Notifier {
  readonly name = "telegram";
  constructor(
    private token: string,
    private defaultChatId?: string,
  ) {}
  async send(n: Notification) {
    const chatId = n.to.telegramChatId ?? this.defaultChatId;
    if (!chatId) return;
    const res = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: `${n.title}\n\n${n.body}${n.link ? `\n${n.link}` : ""}` }),
    });
    if (!res.ok) throw new Error(`telegram ${res.status}`);
  }
}

/**
 * WhatsApp Cloud API (Meta Graph) text message.
 * NOTE: free-form text only delivers inside the 24h customer-service window. Business-initiated
 * notifications (like "new order" to a seller who hasn't messaged you) require an approved
 * *template* message. TODO(go-live): create an `order_created` utility template per language and
 * switch `type: "text"` to `type: "template"`.
 */
export class WhatsAppCloudNotifier implements Notifier {
  readonly name = "whatsapp";
  constructor(
    private token: string,
    private phoneNumberId: string,
    private apiVersion: string,
  ) {}
  async send(n: Notification) {
    if (!n.to.whatsapp) return;
    const res = await fetch(`https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: n.to.whatsapp,
        type: "text",
        text: { body: `${n.title}\n\n${n.body}${n.link ? `\n${n.link}` : ""}` },
      }),
    });
    if (!res.ok) throw new Error(`whatsapp ${res.status}`);
  }
}

export class EmailNotifier implements Notifier {
  readonly name = "email";
  async send(n: Notification) {
    if (!n.to.email) return;
    await emailProvider().send({ to: n.to.email, subject: n.title, text: `${n.body}${n.link ? `\n\n${n.link}` : ""}` });
  }
}

let notifiers: Notifier[] | undefined;

export function getNotifiers(): Notifier[] {
  if (notifiers) return notifiers;
  const e = env();
  const wanted = e.NOTIFY_CHANNELS.split(",").map((s) => s.trim()).filter(Boolean);
  const list: Notifier[] = [];
  for (const c of wanted) {
    if (c === "console") list.push(new ConsoleNotifier());
    else if (c === "telegram" && e.TELEGRAM_BOT_TOKEN) list.push(new TelegramNotifier(e.TELEGRAM_BOT_TOKEN, e.TELEGRAM_DEFAULT_CHAT_ID));
    else if (c === "whatsapp" && e.WHATSAPP_CLOUD_TOKEN && e.WHATSAPP_PHONE_NUMBER_ID)
      list.push(new WhatsAppCloudNotifier(e.WHATSAPP_CLOUD_TOKEN, e.WHATSAPP_PHONE_NUMBER_ID, e.WHATSAPP_API_VERSION));
    else if (c === "email") list.push(new EmailNotifier());
    else logger.warn("notify.channel_not_configured", { channel: c });
  }
  notifiers = list.length ? list : [new ConsoleNotifier()];
  return notifiers;
}

export function setNotifiers(list: Notifier[] | undefined) {
  notifiers = list;
}

/** Fan out to every channel; one failing channel never blocks the others or the caller. */
export async function notify(n: Notification) {
  await Promise.all(
    getNotifiers().map(async (ch) => {
      try {
        await ch.send(n);
      } catch (err) {
        logger.error("notify.failed", { channel: ch.name, kind: n.kind, err });
      }
    }),
  );
}
