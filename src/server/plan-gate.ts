import "server-only";
import { AppError } from "./errors";
import { FEATURE_MIN_PLAN, hasFeature, normalizePlan, type GatedFeature } from "@/lib/plans";

/** Throws FORBIDDEN "plan_feature" unless the store's plan unlocks `f`. The only gate that counts (UI locks are advisory). */
export function assertFeature(store: { plan: string | null | undefined }, f: GatedFeature): void {
  if (!hasFeature(normalizePlan(store.plan), f)) throw new AppError("FORBIDDEN", "plan_feature", { feature: f, min: FEATURE_MIN_PLAN[f] });
}
