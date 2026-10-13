import "server-only";
import { gatewayConfig, RASEDI_GATEWAYS } from "./config";

const LABEL: Record<string, string> = {
  FIB: "FIB",
  ZAIN: "ZainCash",
  ASIA_PAY: "AsiaPay",
  FAST_PAY: "FastPay",
  NASS_WALLET: "NassWallet",
  CREDIT_CARD: "Visa / Mastercard",
};

/**
 * Chips for the checkout selector: the gateways this deployment offers, then FastPay (unless enabled) and Qi Card
 * as "soon". Qi Card is not in Rasedi's gateway enum (2026-10-13), so it stays "soon" whatever the config says.
 */
export function gatewayChips(): { code: string; label: string; soon: boolean }[] {
  const c = gatewayConfig();
  const on = c.provider === "none" ? [] : c.gateways;
  const chips: { code: string; label: string; soon: boolean }[] = RASEDI_GATEWAYS.filter((g) => on.includes(g)).map((g) => ({ code: g, label: LABEL[g]!, soon: false }));
  if (!on.includes("FAST_PAY")) chips.push({ code: "FAST_PAY", label: LABEL.FAST_PAY!, soon: true });
  chips.push({ code: "QI_CARD", label: "Qi Card", soon: true });
  return chips;
}
