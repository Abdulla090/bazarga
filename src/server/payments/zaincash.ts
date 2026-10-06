import { jwtVerify, type JWTPayload } from "jose";
import { AppError } from "../errors";
import { logger } from "../logger";
import type { NormalizedPaymentStatus, PaymentContext, PaymentInit, PaymentProvider } from "./types";

/**
 * ZainCash Payment Gateway v2 (OAuth2 + redirect + signed JWT callbacks).
 * Source: https://docs.zaincash.iq/ (v2 guide, updated Aug 2026).
 *
 *   POST {base}/oauth2/token  (x-www-form-urlencoded: grant_type=client_credentials, client_id, client_secret, scope)
 *   POST {base}/api/v2/payment-gateway/transaction/init   (Bearer; scope payment:write)
 *        body: { language, externalReferenceId(uuid), orderId, serviceType, amount:{value,currency:"IQD"},
 *                customer?:{phone}, redirectUrls:{successUrl,failureUrl} }
 *        → redirect the customer to the returned `redirectUrl` (never build it yourself)
 *   GET  {base}/api/v2/payment-gateway/transaction/inquiry/{transactionId}  (scope payment:read)
 *   Redirect: successUrl?token=JWT / failureUrl?token=JWT — HS256, verify with the merchant API key.
 *   Webhook (production only, URL registered by ZainCash business team): POST { webhook_token: JWT },
 *        payload carries eventId, eventType=STATUS_CHANGED, transactionId, merchantReferenceId, orderId,
 *        currentStatus/previousStatus. Use eventId for idempotency.
 *
 * UAT base: https://pg-api-uat.zaincash.iq — production base URL is issued at onboarding.
 *
 * The docs' sample JSON bodies are not rendered on the public page, so the exact response field
 * names below are read defensively and marked TODO(verify) — confirm against UAT before go-live.
 */
export class ZainCashProvider implements PaymentProvider {
  readonly id = "zaincash" as const;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private cfg: {
      baseUrl: string;
      clientId?: string;
      clientSecret?: string;
      apiKey?: string;
      scope: string;
      enabled: boolean;
    },
    private fetchImpl: typeof fetch = fetch,
  ) {}

  isConfigured() {
    return this.cfg.enabled && !!this.cfg.clientId && !!this.cfg.clientSecret && !!this.cfg.apiKey;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 10_000) return this.token.value;
    const res = await this.fetchImpl(`${this.cfg.baseUrl}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.cfg.clientId ?? "",
        client_secret: this.cfg.clientSecret ?? "",
        scope: this.cfg.scope,
      }),
    });
    if (!res.ok) throw new AppError("PAYMENT_ERROR", `zaincash_auth_${res.status}`);
    const j = (await res.json()) as { access_token: string; expires_in?: number };
    this.token = { value: j.access_token, expiresAt: Date.now() + (j.expires_in ?? 300) * 1000 };
    return j.access_token;
  }

  async createPayment(ctx: PaymentContext): Promise<PaymentInit> {
    if (!this.isConfigured()) throw new AppError("UNAVAILABLE", "zaincash_not_configured");
    const token = await this.accessToken();
    const language = ctx.locale === "ar" ? "ar" : ctx.locale === "en" ? "en" : "ku"; // kmr → ku (closest supported)
    const sep = ctx.returnUrl.includes("?") ? "&" : "?";
    const res = await this.fetchImpl(`${this.cfg.baseUrl}/api/v2/payment-gateway/transaction/init`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        language,
        externalReferenceId: ctx.attemptId,
        orderId: String(ctx.orderNumber),
        serviceType: "mymarket", // docs: no "+" or "," allowed
        amount: { value: ctx.amount, currency: "IQD" },
        customer: { phone: ctx.customerPhone },
        redirectUrls: { successUrl: `${ctx.returnUrl}${sep}r=success`, failureUrl: `${ctx.returnUrl}${sep}r=failure` },
      }),
    });
    if (!res.ok) {
      logger.error("zaincash.init_failed", { status: res.status, body: await res.text().catch(() => "") });
      throw new AppError("PAYMENT_ERROR", `zaincash_init_${res.status}`);
    }
    const raw = (await res.json()) as Record<string, unknown>;
    // TODO(verify): field names per UAT response. Docs + official-partner SDKs use `transactionId` and `redirectUrl`.
    const data = (typeof raw.data === "object" && raw.data ? raw.data : raw) as Record<string, unknown>;
    const transactionId = pickString(data, ["transactionId", "id", "transaction_id"]);
    const url = pickString(data, ["redirectUrl", "redirect_url", "paymentUrl"]);
    if (!transactionId || !url) throw new AppError("PAYMENT_ERROR", "zaincash_bad_init_response");
    return { kind: "redirect", providerRef: transactionId, url, raw };
  }

  async fetchStatus(transactionId: string): Promise<{ status: NormalizedPaymentStatus; raw: Record<string, unknown> }> {
    const token = await this.accessToken();
    const res = await this.fetchImpl(
      `${this.cfg.baseUrl}/api/v2/payment-gateway/transaction/inquiry/${encodeURIComponent(transactionId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new AppError("PAYMENT_ERROR", `zaincash_inquiry_${res.status}`);
    const raw = (await res.json()) as Record<string, unknown>;
    const data = (typeof raw.data === "object" && raw.data ? raw.data : raw) as Record<string, unknown>;
    return { status: mapZainCashStatus(data.status ?? data.currentStatus), raw };
  }

  /** Verify a redirect `token` or webhook `webhook_token` (HS256, merchant API key). Throws if invalid. */
  async verifyCallbackToken(token: string): Promise<JWTPayload & Record<string, unknown>> {
    if (!this.cfg.apiKey) throw new AppError("UNAVAILABLE", "zaincash_not_configured");
    const { payload } = await jwtVerify(token, new TextEncoder().encode(this.cfg.apiKey), { algorithms: ["HS256"] });
    return payload as JWTPayload & Record<string, unknown>;
  }
}

export function pickString(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v) return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

/** Extract identifiers from a decoded redirect/webhook JWT. TODO(verify): exact claim names against UAT. */
export function zainCashClaims(p: Record<string, unknown>) {
  const nested = (typeof p.data === "object" && p.data ? p.data : {}) as Record<string, unknown>;
  const merged = { ...nested, ...p };
  return {
    transactionId: pickString(merged, ["transactionId", "transaction_id", "id"]),
    eventId: pickString(merged, ["eventId", "event_id"]),
    status: merged.currentStatus ?? merged.status,
  };
}

export function mapZainCashStatus(s: unknown): NormalizedPaymentStatus {
  switch (String(s ?? "").toUpperCase()) {
    case "SUCCESS":
    case "COMPLETED":
    case "PARTIALLY_REFUNDED": // still (partly) paid — refunds are handled by the seller manually in v1
      return "paid";
    case "FAILED":
    case "EXPIRED":
      return "failed";
    case "REFUNDED":
      return "refunded";
    default:
      return "pending"; // PENDING, OTP_SENT, CUSTOMER_AUTHENTICATION_REQUIRED
  }
}
