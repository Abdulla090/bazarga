import { AppError } from "../errors";
import { logger } from "../logger";
import type { NormalizedPaymentStatus, PaymentContext, PaymentInit, PaymentProvider } from "./types";

/**
 * First Iraqi Bank (FIB) Online Payments.
 * Source: https://fib.iq/integrations/web-payments/ and the official Node SDK docs
 * (https://first-iraqi-bank.github.io/fib-nodejs-payment-sdk/).
 *
 *   POST {base}/auth/realms/fib-online-shop/protocol/openid-connect/token   (x-www-form-urlencoded, client_credentials)
 *   POST {base}/protected/v1/payments                 → 202 { paymentId, readableCode, qrCode, validUntil, personalAppLink, businessAppLink, corporateAppLink }
 *   GET  {base}/protected/v1/payments/{id}/status     → { paymentId, status: PAID|UNPAID|DECLINED, paidAt, amount, decliningReason, declinedAt, paidBy }
 *   POST {base}/protected/v1/payments/{id}/cancel     → 204
 *   Callback: FIB POSTs { id, status } to statusCallbackUrl when status changes. The body is NOT signed,
 *   so our callback handler re-fetches the status from FIB before changing anything.
 *
 * Sandbox base: https://fib.stage.fib.iq — production base URL is issued with production credentials
 * (TODO: confirm with integration@fib.iq; set FIB_BASE_URL).
 */
export class FibProvider implements PaymentProvider {
  readonly id = "fib" as const;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private cfg: { baseUrl: string; clientId?: string; clientSecret?: string; enabled: boolean },
    private fetchImpl: typeof fetch = fetch,
  ) {}

  isConfigured() {
    return this.cfg.enabled && !!this.cfg.clientId && !!this.cfg.clientSecret;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 5_000) return this.token.value;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.cfg.clientId ?? "",
      client_secret: this.cfg.clientSecret ?? "",
    });
    const res = await this.fetchImpl(`${this.cfg.baseUrl}/auth/realms/fib-online-shop/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new AppError("PAYMENT_ERROR", `fib_auth_${res.status}`);
    const json = (await res.json()) as { access_token: string; expires_in?: number };
    // FIB tokens are short-lived (expires_in: 60 in the docs).
    this.token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 60) * 1000 };
    return json.access_token;
  }

  async createPayment(ctx: PaymentContext): Promise<PaymentInit> {
    if (!this.isConfigured()) throw new AppError("UNAVAILABLE", "fib_not_configured");
    const token = await this.accessToken();
    const res = await this.fetchImpl(`${this.cfg.baseUrl}/protected/v1/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        monetaryValue: { amount: ctx.amount.toFixed(2), currency: "IQD" },
        statusCallbackUrl: ctx.callbackUrl,
        description: ctx.description.slice(0, 50), // docs: max 50 chars
        // `redirectUri` appears in FIB's official Node SDK docs (not in the web API page).
        // TODO(verify in sandbox): confirm the API honours it for app → browser return.
        redirectUri: ctx.returnUrl,
      }),
    });
    if (res.status !== 202 && !res.ok) {
      logger.error("fib.create_failed", { status: res.status, body: await res.text().catch(() => "") });
      throw new AppError("PAYMENT_ERROR", `fib_create_${res.status}`);
    }
    const j = (await res.json()) as Record<string, unknown>;
    const s = (k: string) => (typeof j[k] === "string" ? (j[k] as string) : null);
    const paymentId = s("paymentId");
    if (!paymentId) throw new AppError("PAYMENT_ERROR", "fib_no_payment_id");
    return {
      kind: "qr",
      providerRef: paymentId,
      qrCode: s("qrCode"),
      readableCode: s("readableCode"),
      appLinks: {
        personal: s("personalAppLink") ?? undefined,
        business: s("businessAppLink") ?? undefined,
        corporate: s("corporateAppLink") ?? undefined,
      },
      validUntil: s("validUntil"),
      raw: { ...j, qrCode: undefined }, // don't bloat the DB row with the base64 image twice
    };
  }

  async fetchStatus(paymentId: string): Promise<{ status: NormalizedPaymentStatus; raw: Record<string, unknown> }> {
    const token = await this.accessToken();
    const res = await this.fetchImpl(
      `${this.cfg.baseUrl}/protected/v1/payments/${encodeURIComponent(paymentId)}/status`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new AppError("PAYMENT_ERROR", `fib_status_${res.status}`);
    const raw = (await res.json()) as Record<string, unknown>;
    return { status: mapFibStatus(raw.status), raw };
  }

  async cancel(paymentId: string): Promise<void> {
    const token = await this.accessToken();
    const res = await this.fetchImpl(
      `${this.cfg.baseUrl}/protected/v1/payments/${encodeURIComponent(paymentId)}/cancel`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.status !== 204 && !res.ok) throw new AppError("PAYMENT_ERROR", `fib_cancel_${res.status}`);
  }
}

export function mapFibStatus(s: unknown): NormalizedPaymentStatus {
  switch (s) {
    case "PAID":
      return "paid";
    case "DECLINED":
      return "failed";
    // TODO(verify): the refund endpoint exists (POST /payments/{id}/refund per FIB SDKs); the status value
    // after a refund is not documented on the public page — treat unknown values as pending.
    case "REFUNDED":
      return "refunded";
    default:
      return "pending"; // UNPAID
  }
}
