import "server-only";
import { env } from "../env";
import { isAdminEmail } from "../auth/admin";
import { MockText, resolveTextProvider, type TextProvider } from "./text";
import { hasFeature, normalizePlan } from "@/lib/plans";

const DEMO_EMAIL = (process.env.SEED_DEMO_EMAIL ?? "demo@mymarket.app").toLowerCase();

let cached: TextProvider | null | undefined;
let override: TextProvider | null | undefined;
/** Tests: force a provider (undefined = back to env). */
export function setTextProvider(p: TextProvider | null | undefined) {
  override = p;
}
function envProvider(): TextProvider | null {
  if (override !== undefined) return override;
  if (cached === undefined) cached = resolveTextProvider(env());
  return cached;
}

/**
 * The AI text provider this user may use, or null. A configured key serves everyone (plan gates still apply);
 * with no key, only the seeded demo seller gets the offline mock (AI_DEMO_MOCK, default on) so the demo works.
 */
export function textProviderFor(userEmail: string): TextProvider | null {
  const p = envProvider();
  if (p) return p;
  if (env().AI_DEMO_MOCK && userEmail.toLowerCase() === DEMO_EMAIL) return new MockText();
  return null;
}

/** What the dashboard shows for an AI tool: the tool, a "connect AI" note (operators only), or nothing. */
export function aiUi(userEmail: string): "on" | "connect" | "hidden" {
  if (textProviderFor(userEmail)) return "on";
  return isAdminEmail(userEmail) ? "connect" : "hidden";
}

/** Product form "Write with AI" mode: needs a provider (or the operator "connect" note) and Business+ for the tool. */
export function productAiMode(userEmail: string, plan: string | null | undefined): "on" | "locked" | "connect" | "hidden" {
  const ui = aiUi(userEmail);
  if (ui !== "on") return ui;
  return hasFeature(normalizePlan(plan), "aiDescriptions") ? "on" : "locked";
}
