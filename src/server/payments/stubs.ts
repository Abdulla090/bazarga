import { AppError } from "../errors";
import type { PaymentProvider } from "./types";

/**
 * FastPay — STUB. TODO(go-live): FastPay's merchant API docs are issued privately on onboarding
 * (https://fast-pay.iq). Implement createPayment (initiate → redirect URL), fetchStatus and
 * callback verification once credentials + docs are received. Do not enable in production until then.
 */
export class FastPayProvider implements PaymentProvider {
  readonly id = "fastpay" as const;
  constructor(private enabled: boolean) {}
  isConfigured() {
    void this.enabled; // honoured once implemented
    return false;
  }
  async createPayment(): Promise<never> {
    throw new AppError("UNAVAILABLE", "fastpay_not_implemented");
  }
}

/**
 * Qi Card (International Smart Card) — STUB. TODO(go-live): obtain the Qi payment gateway merchant
 * API spec and credentials; implement hosted-payment-page redirect, status inquiry and signed callback.
 */
export class QiCardProvider implements PaymentProvider {
  readonly id = "qicard" as const;
  constructor(private enabled: boolean) {}
  isConfigured() {
    void this.enabled;
    return false;
  }
  async createPayment(): Promise<never> {
    throw new AppError("UNAVAILABLE", "qicard_not_implemented");
  }
}
