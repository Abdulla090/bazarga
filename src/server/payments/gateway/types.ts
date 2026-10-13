import type { RasediGateway } from "./config";

/** Our payment state machine (payments.status). See docs/PAYMENTS.md. */
export type GatewayStatus = "pending" | "paid" | "failed" | "expired" | "refunded";

export type CheckoutInput = {
  /** payments.id — our idempotency key and the only id we put in URLs we hand out. */
  paymentId: string;
  amountIqd: number;
  title: string;
  description: string;
  gateways: RasediGateway[];
  /** Where the shopper/seller lands after the hosted page (GET /payments/return?p=…). Never trusted for status. */
  redirectUrl: string;
  /** Server-to-server status webhook (POST /api/payments/webhook/<provider>?token=…). */
  callbackUrl: string;
  collectFeeFromCustomer: boolean;
  collectCustomerPhoneNumber: boolean;
};

export type CheckoutResult = { providerRef: string; checkoutUrl: string; raw: Record<string, unknown> };

export type ProviderStatus = {
  status: GatewayStatus;
  /** Gateway the customer actually paid with (e.g. "FIB"), when the provider says. */
  gateway: string | null;
  paidAt: string | null;
  raw: Record<string, unknown>;
};

export type VerifiedWebhook = {
  providerRef: string;
  /** Unique per (payment, reported status) — the idempotency key in payment_events. */
  eventId: string;
  /** What the webhook CLAIMS. Informational only: state changes always re-fetch getStatus(). */
  reportedStatus: string;
  payload: Record<string, unknown>;
};

export type WebhookRequest = { url: string; headers: Headers; body: string };

/**
 * The provider abstraction every gateway implements. Implementations: RasediProvider (real), MockProvider (dev/tests).
 */
export interface GatewayProvider {
  readonly id: "rasedi" | "mock";
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Authoritative status straight from the provider. */
  getStatus(providerRef: string): Promise<ProviderStatus>;
  /** Authenticate a webhook request; null → reject with 401. Must not do I/O beyond parsing. */
  verifyWebhook(req: WebhookRequest): VerifiedWebhook | null;
  /** Cancel a still-pending hosted checkout (best effort). */
  cancel?(providerRef: string): Promise<void>;
  /** Not offered by Rasedi's public API as of 2026-10-13 — refunds are manual until it is (docs/PAYMENTS.md). */
  refund?(providerRef: string, amountIqd: number): Promise<void>;
}
