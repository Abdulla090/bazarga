import "server-only";
import { sign } from "node:crypto";
import { z } from "zod";
import { AppError } from "../../errors";
import { logger } from "../../logger";
import type { CheckoutInput, CheckoutResult, GatewayProvider, GatewayStatus, ProviderStatus, VerifiedWebhook, WebhookRequest } from "./types";
import { webhookTokenOk } from "./webhook-token";

/**
 * Rasedi (https://rasedi.com/docs/api-references/, JS SDK rasedi-sdk@1.0.9 — read 2026-10-13). Thin typed fetch client
 * instead of the npm SDK (which pulls axios + node-forge + elliptic into the server bundle):
 *
 *   base   https://api.rasedi.com
 *   POST   /v1/payment/rest/{test|live}/create            body: amount (string, smallest unit — IQD × 100), title,
 *          description, gateways[], redirectUrl, callbackUrl, collectFeeFromCustomer, collectCustomerEmail,
 *          collectCustomerPhoneNumber, allowPromoCode → { referenceCode, amount, paidVia, paidAt, redirectUrl, status, payoutAmount }
 *   GET    /v1/payment/rest/{mode}/status/{referenceCode}  → same shape
 *   PATCH  /v1/payment/rest/{mode}/cancel/{referenceCode}
 *   auth   x-id: <merchant secret key>; x-signature: base64(sign(privateKeyPem, "<METHOD> || <x-id> || <relative path>"))
 *          — Ed25519 (crypto.sign(null, …), passphrase = secret key for encrypted PEMs, as in the docs' Node reference).
 *   status PENDING | PAID | FAILED | CANCELED | TIMED_OUT
 *   webhook POST callbackUrl { referenceCode, status, payoutAmount } with x-id / x-signature headers whose exact
 *          scheme is not documented → we authenticate with a secret token in our own callbackUrl and then RE-FETCH
 *          the status (docs: "Verify webhook notifications by querying the actual payment status").
 */
export type RasediOptions = {
  apiBase: string;
  mode: "test" | "live";
  keyId: string;
  privateKeyPem: string;
  webhookSecret: string;
  amountScale: number;
  timeoutMs?: number;
};

const paymentBody = z
  .object({
    referenceCode: z.string().min(1).max(200),
    amount: z.union([z.string(), z.number()]).nullish(),
    paidVia: z.string().nullish(),
    paidAt: z.string().nullish(),
    redirectUrl: z.string().nullish(),
    status: z.string(),
    payoutAmount: z.union([z.string(), z.number()]).nullish(),
  })
  .passthrough();

const webhookBody = z
  .object({ referenceCode: z.string().min(1).max(200), status: z.string().max(40), payoutAmount: z.union([z.string(), z.number()]).nullish() })
  .passthrough();

export function mapRasediStatus(s: string): GatewayStatus {
  switch (s.toUpperCase()) {
    case "PAID":
      return "paid";
    case "FAILED":
    case "CANCELED":
    case "CANCELLED":
      return "failed";
    case "TIMED_OUT":
      return "expired";
    case "REFUNDED":
      return "refunded";
    default:
      return "pending";
  }
}

/** Build the x-signature for a request — exported for tests. */
export function rasediSignature(method: string, keyId: string, relativeUrl: string, privateKeyPem: string): string {
  const raw = Buffer.from(`${method.toUpperCase()} || ${keyId} || ${relativeUrl}`, "utf8");
  return sign(null, raw, { key: privateKeyPem, passphrase: keyId }).toString("base64");
}

export class RasediProvider implements GatewayProvider {
  readonly id = "rasedi" as const;
  constructor(
    private o: RasediOptions,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async call(method: "GET" | "POST" | "PATCH", endpoint: string, body?: unknown) {
    const path = `/v1/payment/rest/${this.o.mode}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-id": this.o.keyId,
      "x-signature": rasediSignature(method, this.o.keyId, path, this.o.privateKeyPem),
    };
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.o.apiBase}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.o.timeoutMs ?? 10_000),
        cache: "no-store",
      });
    } catch (err) {
      logger.warn("rasedi.network", { endpoint: endpoint.split("/")[1], err });
      throw new AppError("PAYMENT_ERROR", "rasedi_network");
    }
    const text = await res.text();
    if (res.status < 200 || res.status > 209) {
      logger.error("rasedi.http_error", { endpoint: endpoint.split("/")[1], status: res.status, body: text.slice(0, 500) });
      throw new AppError("PAYMENT_ERROR", `rasedi_${res.status}`);
    }
    const parsed = paymentBody.safeParse(text ? JSON.parse(text) : null);
    if (!parsed.success) throw new AppError("PAYMENT_ERROR", "rasedi_bad_response");
    return parsed.data;
  }

  async createCheckout(i: CheckoutInput): Promise<CheckoutResult> {
    const b = await this.call("POST", "/create", {
      amount: String(Math.round(i.amountIqd) * this.o.amountScale),
      title: i.title.slice(0, 100),
      description: i.description.slice(0, 500),
      gateways: i.gateways,
      redirectUrl: i.redirectUrl,
      callbackUrl: i.callbackUrl,
      collectFeeFromCustomer: i.collectFeeFromCustomer,
      collectCustomerEmail: false,
      collectCustomerPhoneNumber: i.collectCustomerPhoneNumber,
      allowPromoCode: false,
    });
    if (!b.redirectUrl) throw new AppError("PAYMENT_ERROR", "rasedi_no_redirect");
    return { providerRef: b.referenceCode, checkoutUrl: b.redirectUrl, raw: b };
  }

  async getStatus(ref: string): Promise<ProviderStatus> {
    const b = await this.call("GET", `/status/${encodeURIComponent(ref)}`);
    return { status: mapRasediStatus(b.status), gateway: b.paidVia ?? null, paidAt: b.paidAt ?? null, raw: b };
  }

  async cancel(ref: string): Promise<void> {
    await this.call("PATCH", `/cancel/${encodeURIComponent(ref)}`);
  }

  verifyWebhook(req: WebhookRequest): VerifiedWebhook | null {
    if (!webhookTokenOk(req.url, this.o.webhookSecret)) return null;
    let json: unknown;
    try {
      json = JSON.parse(req.body);
    } catch {
      return null;
    }
    const b = webhookBody.safeParse(json);
    if (!b.success) return null;
    return { providerRef: b.data.referenceCode, eventId: `${b.data.referenceCode}:${b.data.status.toUpperCase()}`, reportedStatus: b.data.status, payload: b.data };
  }
}
