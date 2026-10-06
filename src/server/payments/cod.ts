import type { PaymentProvider } from "./types";

/** Cash on Delivery: nothing to do online; the order is marked paid when the seller marks it delivered. */
export class CodProvider implements PaymentProvider {
  readonly id = "cod" as const;
  isConfigured() {
    return true;
  }
  async createPayment() {
    return { kind: "offline" as const };
  }
}
