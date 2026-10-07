import "server-only";
import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** postgres://… in production. `pglite://./.pglite` (file) or `pglite://memory` for zero-setup local dev. */
  DATABASE_URL: z.string().default("pglite://./.pglite"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  /** Root domain used for {slug}.ROOT_DOMAIN storefront subdomains, e.g. mymarket.app */
  ROOT_DOMAIN: z.string().default("mymarket.app"),
  SESSION_COOKIE_NAME: z.string().default("mm_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Storage
  /** Unset → R2/S3 when S3_BUCKET + keys + S3_PUBLIC_URL are all present, else local disk. */
  STORAGE_DRIVER: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["local", "s3"]).optional()),
  UPLOAD_DIR: z.string().default("./uploads"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  /** Cloudflare account id — derives S3_ENDPOINT=https://<id>.r2.cloudflarestorage.com when S3_ENDPOINT is unset. */
  R2_ACCOUNT_ID: z.string().optional(),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),

  // Email
  EMAIL_DRIVER: z.enum(["console", "resend"]).default("console"),
  EMAIL_FROM: z.string().default("Bazarga <hello@mymarket.app>"),
  RESEND_API_KEY: z.string().optional(),

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

  // AI store builder
  AI_ENABLED: bool,
  AI_PROVIDER: z.enum(["openai", "mock"]).default("openai"),
  AI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("gpt-4o-mini"),
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
