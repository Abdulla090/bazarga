import { resolveStorageConfig, type StorageEnv } from "./storage/config";
import { resolveEmailConfig } from "./email";
import { resolveDomainConfig } from "@/lib/domains";
import { resolveTextProvider, type AiTextEnv } from "./ai/text";

/**
 * Which external services are plugged in, from env only (pure; shown on /api/health). Driver names and booleans,
 * never a key, a bucket name or an address. Payments are deliberately left out (owned by src/server/payments).
 */
export type IntegrationStatus = {
  storage: { driver: "local" | "s3" | "supabase" | "misconfigured"; fallback?: boolean };
  email: { driver: "console" | "resend" | "brevo"; keyMissing?: boolean };
  cron: boolean;
  subdomains: boolean;
  push: boolean;
  ai: boolean;
  /** AI text (descriptions, website designer): which buyer key is set, or "off" (demo seller still gets the mock). */
  aiText: "gemini" | "openai" | "mock" | "off";
};

type Env = StorageEnv &
  Record<string, unknown> & {
    EMAIL_FROM: string;
    CRON_SECRET?: string;
    ROOT_DOMAIN?: string;
    STORE_SUBDOMAINS?: string;
    AI_ENABLED?: boolean;
    AI_API_KEY?: string;
    AI_PROVIDER?: string;
  };

export function integrationStatus(e: Env, runtime: { serverless?: boolean } = {}): IntegrationStatus {
  let storage: IntegrationStatus["storage"];
  try {
    const c = resolveStorageConfig(e, runtime);
    storage = c.driver === "supabase" && c.fallbackFrom ? { driver: "supabase", fallback: true } : { driver: c.driver };
  } catch {
    storage = { driver: "misconfigured" };
  }
  const em = resolveEmailConfig(e as Parameters<typeof resolveEmailConfig>[0]);
  const email: IntegrationStatus["email"] = em.wanted !== "console" && em.driver === "console" ? { driver: "console", keyMissing: true } : { driver: em.driver };
  const str = (k: string) => (typeof e[k] === "string" ? (e[k] as string) : undefined);
  return {
    storage,
    email,
    cron: !!e.CRON_SECRET,
    subdomains: resolveDomainConfig(e).subdomains,
    // Same rule as pushConfig() in ./push: all three VAPID values present.
    push: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"].every((k) => !!str(k)?.trim()),
    ai: !!e.AI_ENABLED && (e.AI_PROVIDER === "mock" || !!e.AI_API_KEY),
    aiText: resolveTextProvider(e as AiTextEnv)?.name ?? "off",
  };
}
