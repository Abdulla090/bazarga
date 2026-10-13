import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError } from "../../errors";
import type { CheckoutInput, CheckoutResult, GatewayProvider, GatewayStatus, ProviderStatus, VerifiedWebhook, WebhookRequest } from "./types";
import { webhookTokenOk } from "./webhook-token";

type MockPayment = { status: GatewayStatus; amountIqd: number; gateway: string | null; input: CheckoutInput };

/**
 * In-memory stand-in for Rasedi with the same contract (hosted page URL, status lookup, token-authenticated webhook
 * that carries Rasedi's { referenceCode, status } body). Used by tests and local dev (PAYMENTS_PROVIDER=mock); refused
 * in production unless PAYMENTS_ALLOW_MOCK=true. The "hosted page" is our own return page.
 */
export class MockProvider implements GatewayProvider {
  readonly id = "mock" as const;
  readonly store = new Map<string, MockPayment>();
  failNextCreate = false;
  constructor(private webhookSecret: string) {}

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (this.failNextCreate) {
      this.failNextCreate = false;
      throw new AppError("PAYMENT_ERROR", "mock_create_failed");
    }
    const ref = `mock_${randomUUID()}`;
    this.store.set(ref, { status: "pending", amountIqd: input.amountIqd, gateway: null, input });
    const url = new URL(input.redirectUrl);
    url.searchParams.set("mock", "1");
    return { providerRef: ref, checkoutUrl: url.toString(), raw: { referenceCode: ref, status: "PENDING" } };
  }

  async getStatus(ref: string): Promise<ProviderStatus> {
    const p = this.store.get(ref);
    if (!p) throw new AppError("PAYMENT_ERROR", "mock_not_found");
    return { status: p.status, gateway: p.gateway, paidAt: p.status === "paid" ? new Date().toISOString() : null, raw: { referenceCode: ref, status: p.status.toUpperCase() } };
  }

  async cancel(ref: string) {
    const p = this.store.get(ref);
    if (p && p.status === "pending") p.status = "failed";
  }

  verifyWebhook(req: WebhookRequest): VerifiedWebhook | null {
    if (!webhookTokenOk(req.url, this.webhookSecret)) return null;
    const b = z.object({ referenceCode: z.string().min(1).max(200), status: z.string().max(40) }).passthrough().safeParse(safeJson(req.body));
    if (!b.success) return null;
    return { providerRef: b.data.referenceCode, eventId: `${b.data.referenceCode}:${b.data.status.toUpperCase()}`, reportedStatus: b.data.status, payload: b.data };
  }

  /** Test/dev helper: what the customer did on the hosted page. */
  settle(ref: string, status: GatewayStatus, gateway = "FIB") {
    const p = this.store.get(ref);
    if (!p) throw new Error("unknown mock payment");
    p.status = status;
    p.gateway = status === "paid" ? gateway : p.gateway;
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
