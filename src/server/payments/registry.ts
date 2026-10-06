import { env } from "../env";
import type { PaymentMethod } from "@/lib/order-status";
import { CodProvider } from "./cod";
import { FibProvider } from "./fib";
import { ZainCashProvider } from "./zaincash";
import { FastPayProvider, QiCardProvider } from "./stubs";
import type { PaymentProvider } from "./types";

type Registry = {
  cod: CodProvider;
  fib: FibProvider;
  zaincash: ZainCashProvider;
  fastpay: FastPayProvider;
  qicard: QiCardProvider;
};

let registry: Registry | undefined;

function build(): Registry {
  const e = env();
  return {
    cod: new CodProvider(),
    fib: new FibProvider({
      baseUrl: e.FIB_BASE_URL.replace(/\/$/, ""),
      clientId: e.FIB_CLIENT_ID,
      clientSecret: e.FIB_CLIENT_SECRET,
      enabled: e.FIB_ENABLED,
    }),
    zaincash: new ZainCashProvider({
      baseUrl: e.ZAINCASH_BASE_URL.replace(/\/$/, ""),
      clientId: e.ZAINCASH_CLIENT_ID,
      clientSecret: e.ZAINCASH_CLIENT_SECRET,
      apiKey: e.ZAINCASH_API_KEY,
      scope: e.ZAINCASH_SCOPE,
      enabled: e.ZAINCASH_ENABLED,
    }),
    fastpay: new FastPayProvider(e.FASTPAY_ENABLED),
    qicard: new QiCardProvider(e.QICARD_ENABLED),
  };
}

export function providers(): Registry {
  return (registry ??= build());
}

export function getProvider(m: PaymentMethod): PaymentProvider {
  return providers()[m];
}

/** COD always; online providers only when credentials are configured on this deployment. */
export function isProviderAvailable(m: PaymentMethod): boolean {
  return getProvider(m).isConfigured();
}

export function setProviders(r: Partial<Registry> | undefined) {
  registry = r ? ({ ...build(), ...r } as Registry) : undefined;
}
