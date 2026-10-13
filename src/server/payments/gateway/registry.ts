import "server-only";
import { gatewayConfig, type GatewayConfig } from "./config";
import { MockProvider } from "./mock";
import { RasediProvider } from "./rasedi";
import type { GatewayProvider } from "./types";

let instance: GatewayProvider | null | undefined;

function build(c: GatewayConfig): GatewayProvider | null {
  if (c.provider === "none") return null;
  if (c.provider === "mock") return new MockProvider(c.webhookSecret);
  return new RasediProvider({
    apiBase: c.apiBase,
    mode: c.mode === "live" ? "live" : "test",
    keyId: c.keyId,
    privateKeyPem: c.privateKeyPem,
    webhookSecret: c.webhookSecret,
    amountScale: c.amountScale,
  });
}

/** The active gateway, or null when PAYMENTS_PROVIDER is none/unset/invalid (today's behaviour: no online payments). */
export function gateway(): GatewayProvider | null {
  if (instance === undefined) instance = build(gatewayConfig());
  return instance;
}

export function gatewayEnabled(): boolean {
  return gateway() !== null;
}

/** Test helper: override (or reset with undefined) the active provider. */
export function setGateway(p: GatewayProvider | null | undefined) {
  instance = p;
}
