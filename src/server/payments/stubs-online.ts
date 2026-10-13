import { AppError } from "../errors";
import type { PaymentProvider } from "./types";

/**
 * Legacy-registry placeholder for the `online` method. Online (gateway) payments do NOT go through this per-method
 * registry — they use src/server/payments/gateway (payments table, hosted checkout). This shim exists only so the
 * per-method registry stays total; it reports "not configured" so legacy code paths (cart filter, reconcile) skip it.
 */
export class OnlineGatewayShim implements PaymentProvider {
  readonly id = "online" as const;
  isConfigured() {
    return false;
  }
  async createPayment(): Promise<never> {
    throw new AppError("UNAVAILABLE", "use_gateway_checkout");
  }
}
