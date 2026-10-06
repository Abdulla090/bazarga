import type { PaymentMethod } from "@/lib/order-status";
import type { Locale } from "@/lib/i18n";

export type NormalizedPaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type PaymentContext = {
  /** Our payment_transactions.id — also used as the provider idempotency/reference key. */
  attemptId: string;
  orderId: string;
  orderNumber: number;
  amount: number; // whole IQD
  description: string;
  locale: Locale;
  customerPhone: string;
  /** Where the customer lands after paying (provider redirect flows). */
  returnUrl: string;
  /** Server-to-server status callback / webhook URL. */
  callbackUrl: string;
};

export type PaymentInit =
  | { kind: "offline" }
  | { kind: "redirect"; providerRef: string; url: string; raw: Record<string, unknown> }
  | {
      kind: "qr";
      providerRef: string;
      qrCode: string | null;
      readableCode: string | null;
      appLinks: { personal?: string; business?: string; corporate?: string };
      validUntil: string | null;
      raw: Record<string, unknown>;
    };

export interface PaymentProvider {
  readonly id: PaymentMethod;
  /** True when the deployment has the credentials needed to take this payment method live. */
  isConfigured(): boolean;
  createPayment(ctx: PaymentContext): Promise<PaymentInit>;
  /** Authoritative status from the provider (used by callbacks — never trust callback bodies alone). */
  fetchStatus?(providerRef: string): Promise<{ status: NormalizedPaymentStatus; raw: Record<string, unknown> }>;
}
