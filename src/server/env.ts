import "server-only";
import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** postgres://… in production. `pglite://./.pglite` (file) or `pglite://memory` for zero-setup local dev. */
  DATABASE_URL: z.string().default(process.env.POSTGRES_URL || "pglite://./.pglite"),
  // ^ Vercel + Supabase integration injects POSTGRES_URL (pooled) instead of DATABASE_URL.
  APP_URL: z.string().url().default("http://localhost:3000"),
  /** Root domain used for {slug}.ROOT_DOMAIN storefront subdomains, e.g. mymarket.app */
  ROOT_DOMAIN: z.string().optional(),
  /** Kill switch for {slug}.ROOT_DOMAIN routing ("false" turns it off while keeping ROOT_DOMAIN). See src/lib/domains.ts. */
  STORE_SUBDOMAINS: z.string().optional(),
  SESSION_COOKIE_NAME: z.string().default("mm_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /** Optional: every error log line is also POSTed here (Discord/Slack webhook or any JSON sink). See src/server/logger.ts. */
  LOG_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),

  // Storage
  /** Unset → R2/S3 when S3_BUCKET + keys + S3_PUBLIC_URL are all present, else local disk. */
  STORAGE_DRIVER: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["local", "s3", "r2", "supabase"]).optional()),
  UPLOAD_DIR: z.string().default("./uploads"),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_BUCKET: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  /** Cloudflare account id — derives S3_ENDPOINT=https://<id>.r2.cloudflarestorage.com when S3_ENDPOINT is unset. */
  R2_ACCOUNT_ID: z.string().optional(),
  /** R2_* aliases for the S3_* bucket values (S3_* wins when both are set). */
  R2_BUCKET: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),

  // Email
  /** console (default, logs the mail) | resend | brevo (both have free tiers). A provider without its key falls back to console. */
  EMAIL_DRIVER: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["console", "resend", "brevo"]).optional()),
  /** Preferred name for EMAIL_DRIVER (same values). EMAIL_PROVIDER wins when both are set. */
  EMAIL_PROVIDER: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["console", "resend", "brevo"]).optional()),
  /** One key for whichever provider is selected; RESEND_API_KEY / BREVO_API_KEY still work and win when set. */
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Reelcart <hello@mymarket.app>"),
  RESEND_API_KEY: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),

  // Notifications (comma separated: console,telegram,whatsapp,email)
  NOTIFY_CHANNELS: z.string().default("console"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_DEFAULT_CHAT_ID: z.string().optional(),
  WHATSAPP_CLOUD_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default("v21.0"),

  // Web push (seller new-order alerts). All three set → feature on; read via src/server/push pushConfig().
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),

  // OTP
  OTP_DRIVER: z.enum(["console"]).default("console"),

  // Payments
  FIB_ENABLED: bool,
  FIB_BASE_URL: z.string().default("https://fib.stage.fib.iq"),
  FIB_CLIENT_ID: z.string().optional(),
  FIB_CLIENT_SECRET: z.string().optional(),
  ZAINCASH_ENABLED: bool,
  ZAINCASH_BASE_URL: z.string().default("https://pg-api-uat.zaincash.iq"),
  ZAINCASH_CLIENT_ID: z.string().optional(),
  ZAINCASH_CLIENT_SECRET: z.string().optional(),
  ZAINCASH_API_KEY: z.string().optional(),
  ZAINCASH_SCOPE: z.string().default("payment:read payment:write"),
  FASTPAY_ENABLED: bool,
  QICARD_ENABLED: bool,
  /**
   * Payment reconciliation + abandoned-order expiry (src/server/payments/reconcile.ts). The cron route
   * /api/cron/payments only runs with `Authorization: Bearer <CRON_SECRET>`; unset → the route is off (404).
   */
  CRON_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(16).optional()),
  /** Comma-separated emails allowed into /admin (manual plan activation). Unset → /admin is 404. */
  ADMIN_EMAILS: z.string().default(""),
  /** Unpaid online orders still pending after this many minutes are cancelled and their stock released. */
  PAYMENT_ORDER_TTL_MINUTES: z.coerce.number().int().min(5).max(7 * 24 * 60).default(60),

  // AI store builder
  AI_ENABLED: bool,
  AI_PROVIDER: z.enum(["openai", "mock"]).default("openai"),
  AI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("gpt-4o-mini"),
  /**
   * AI text (SF5 descriptions, SF10 website designer). Buyer-supplied keys; any one turns it on.
   * GEMINI_API_KEY wins over OPENAI_API_KEY; AI_API_KEY (with AI_BASE_URL) is the OpenAI-compatible fallback.
   * AI_DEMO_MOCK (default on): the seeded demo seller gets the offline mock when no key is set, so the demo works.
   */
  GEMINI_API_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
  OPENAI_API_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  AI_DEMO_MOCK: z.string().optional().transform((v) => !/^(false|0|off|no)$/i.test((v ?? "").trim())),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Parsed, validated environment. Lazy so `next build` works without runtime secrets. */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid environment: ${parsed.error.message}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** Test helper. */
export function resetEnvCache() {
  cached = undefined;
}
