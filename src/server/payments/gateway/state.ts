import type { GatewayStatus } from "./types";

/**
 * Forward-only state machine for payments.status:
 *
 *   pending ──► paid ──► refunded
 *      ├──────► failed ──► paid   (a late success after a decline/cancel still counts)
 *      └──────► expired ─► paid   (paid just as the link timed out)
 */
export const GATEWAY_TRANSITIONS: Record<GatewayStatus, readonly GatewayStatus[]> = {
  pending: ["paid", "failed", "expired"],
  failed: ["paid"],
  expired: ["paid"],
  paid: ["refunded"],
  refunded: [],
};

export function canMove(from: GatewayStatus, to: GatewayStatus): boolean {
  return from !== to && GATEWAY_TRANSITIONS[from].includes(to);
}
