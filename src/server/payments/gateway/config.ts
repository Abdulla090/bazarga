import "server-only";
import { z } from "zod";
import { logger } from "../../logger";

/**
 * Gateway configuration, validated with zod on first use (boot) and FAIL-CLOSED: any invalid or incomplete
 * value turns online payments off (provider "none") and logs `payments.config_invalid` — the rest of the site keeps
 * working exactly as with PAYMENTS_PROVIDER unset. Kept out of src/server/env.ts on purpose so a payments typo can
 * never take the whole app down.
 */
export const RASEDI_GATEWAYS = ["FIB", "ZAIN", "ASIA_PAY", "FAST_PAY", "NASS_WALLET", "CREDIT_CARD"] as const;
export type RasediGateway = (typeof RASEDI_GATEWAYS)[number];
/** Shown by default; FAST_PAY stays "soon" until RASEDI_GATEWAYS lists it (FastPay is enabled per merchant). */
export const DEFAULT_GATEWAYS: RasediGateway[] = ["FIB", "ZAIN", "ASIA_PAY", "NASS_WALLET", "CREDIT_CARD"];

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const opt = <T extends z.ZodTypeAny>(s: T) => z.preprocess(blank, s.optional());

const base = z.object({
  PAYMENTS_PROVIDER: z.preprocess(blank, z.enum(["none", "mock", "rasedi"]).default("none")),
  USD_IQD_RATE: z.preprocess(blank, z.coerce.number().int().min(500).max(5000).default(1310)),
  PLATFORM_COMMISSION_BPS: z.preprocess(blank, z.coerce.number().int().min(0).max(5000).default(0)),
  RASEDI_MODE: z.preprocess(blank, z.enum(["test", "live", "mock"]).default("test")),
  RASEDI_API_BASE: z.preprocess(blank, z.string().url().default("https://api.rasedi.com")),
  /** x-id header: the merchant "secret key" from the Rasedi panel (test_… / live_…). */
  RASEDI_KEY_ID: opt(z.string().min(8).max(200)),
  /** Ed25519 (or RSA) private key, PEM. Literal "\n" sequences are accepted (Vercel single-line env). */
  RASEDI_PRIVATE_KEY: opt(z.string().min(40)),
  /** Shared secret embedded in our callbackUrl (?token=…); a webhook without it is rejected with 401. */
  RASEDI_WEBHOOK_SECRET: opt(z.string().min(24).max(200)),
  /** Comma list of Rasedi gateway codes to offer; default FIB,ZAIN,ASIA_PAY,NASS_WALLET,CREDIT_CARD. */
  RASEDI_GATEWAYS: opt(z.string()),
  /** Docs: "amount in the smallest unit; for IQD multiply by 100". Override only if Rasedi tells you otherwise. */
  RASEDI_AMOUNT_SCALE: z.preprocess(blank, z.coerce.number().int().refine((n) => [1, 100, 1000].includes(n)).default(100)),
  /** collectFeeFromCustomer for storefront orders (subscriptions never add fees on top). */
  RASEDI_FEE_FROM_CUSTOMER: z.preprocess(blank, z.enum(["true", "false"]).default("false")),
});

export type GatewayConfig =
  | { provider: "none"; reason: "off" | "invalid"; usdIqdRate: number; commissionBps: number }
  | {
      provider: "mock" | "rasedi";
      mode: "test" | "live" | "mock";
      apiBase: string;
      keyId: string;
      privateKeyPem: string;
      webhookSecret: string;
      gateways: RasediGateway[];
      amountScale: number;
      feeFromCustomer: boolean;
      usdIqdRate: number;
      commissionBps: number;
    };

export function parseGatewayConfig(source: Record<string, string | undefined>): GatewayConfig {
  const parsed = base.safeParse(source);
  if (!parsed.success) {
    logger.error("payments.config_invalid", { issues: parsed.error.issues.map((i) => i.path.join(".")) });
    return { provider: "none", reason: "invalid", usdIqdRate: 1310, commissionBps: 0 };
  }
  const e = parsed.data;
  const common = { usdIqdRate: e.USD_IQD_RATE, commissionBps: e.PLATFORM_COMMISSION_BPS };
  if (e.PAYMENTS_PROVIDER === "none") return { provider: "none", reason: "off", ...common };
  const gateways = e.RASEDI_GATEWAYS
    ? e.RASEDI_GATEWAYS.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : DEFAULT_GATEWAYS;
  const badGateway = gateways.find((g) => !(RASEDI_GATEWAYS as readonly string[]).includes(g));
  const fail = (why: string): GatewayConfig => {
    logger.error("payments.config_invalid", { issues: [why] });
    return { provider: "none", reason: "invalid", ...common };
  };
  if (badGateway || gateways.length === 0) return fail("RASEDI_GATEWAYS");
  if (e.PAYMENTS_PROVIDER === "mock" || e.RASEDI_MODE === "mock") {
    if (source.NODE_ENV === "production" && source.PAYMENTS_ALLOW_MOCK !== "true") return fail("mock_in_production");
    return {
      provider: "mock",
      mode: "mock",
      apiBase: "mock://",
      keyId: "mock",
      privateKeyPem: "",
      webhookSecret: e.RASEDI_WEBHOOK_SECRET ?? "mock-webhook-secret-0123456789abcdef",
      gateways: gateways as RasediGateway[],
      amountScale: e.RASEDI_AMOUNT_SCALE,
      feeFromCustomer: e.RASEDI_FEE_FROM_CUSTOMER === "true",
      ...common,
    };
  }
  if (!e.RASEDI_KEY_ID) return fail("RASEDI_KEY_ID");
  if (!e.RASEDI_PRIVATE_KEY) return fail("RASEDI_PRIVATE_KEY");
  if (!e.RASEDI_WEBHOOK_SECRET) return fail("RASEDI_WEBHOOK_SECRET");
  const pem = e.RASEDI_PRIVATE_KEY.replace(/\\n/g, "\n");
  if (!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(pem)) return fail("RASEDI_PRIVATE_KEY_PEM");
  // Live keys must run in live mode and test keys in test mode (Rasedi decides the env from the URL path).
  const keyLooksTest = /test/i.test(e.RASEDI_KEY_ID);
  if (e.RASEDI_MODE === "live" && keyLooksTest) return fail("RASEDI_MODE_live_with_test_key");
  return {
    provider: "rasedi",
    mode: e.RASEDI_MODE,
    apiBase: e.RASEDI_API_BASE.replace(/\/$/, ""),
    keyId: e.RASEDI_KEY_ID,
    privateKeyPem: pem,
    webhookSecret: e.RASEDI_WEBHOOK_SECRET,
    gateways: gateways as RasediGateway[],
    amountScale: e.RASEDI_AMOUNT_SCALE,
    feeFromCustomer: e.RASEDI_FEE_FROM_CUSTOMER === "true",
    ...common,
  };
}

let cached: GatewayConfig | undefined;
export function gatewayConfig(): GatewayConfig {
  return (cached ??= parseGatewayConfig(process.env));
}
/** Test helper. */
export function resetGatewayConfig(c?: GatewayConfig) {
  cached = c;
}
