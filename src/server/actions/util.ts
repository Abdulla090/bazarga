import "server-only";
import { z } from "zod";
import { isAppError } from "../errors";
import { logger } from "../logger";

export type ActionState = {
  ok?: boolean;
  /** i18n key under `errors.*` */
  error?: string;
  /** field name → i18n key under `errors.*` */
  fieldErrors?: Record<string, string>;
  message?: string;
};

const SPECIFIC = new Set([
  "email_taken", "invalid_credentials", "slug_taken", "invalid_slug", "invalid_phone", "password_short",
  "invalid_or_expired_token", "invalid_city", "product_unavailable", "payment_method_unavailable", "out_of_stock",
  "invalid_transition", "file_too_large", "unsupported_image_type", "ai_disabled", "name_required", "empty_file", "nothing_to_read",
  "image_too_large", "invalid_color", "invalid_threshold", "invalid_image_url",
  "phone_operator", "address_required", "invalid_area", "variant_required", "discount_invalid", "discount_inactive",
  "discount_not_started", "discount_expired", "discount_used_up", "discount_below_minimum",
  "spec_label_required", "spec_value_required", "too_many_specs", "invalid_sku",
  "discount_code_taken", "invalid_discount_code", "invalid_percent", "invalid_date", "invalid_date_range",
  "order_rejected", "too_many_orders",
]);

/** Convert any thrown error into a serialisable, translatable action result. Unexpected errors are logged, not leaked. */
export function toActionState(err: unknown): ActionState {
  if (err instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      if (!fieldErrors[key]) fieldErrors[key] = SPECIFIC.has(issue.message) ? issue.message : "VALIDATION";
    }
    return { ok: false, error: "VALIDATION", fieldErrors };
  }
  if (isAppError(err)) return { ok: false, error: SPECIFIC.has(err.message) ? err.message : err.code };
  // Let Next.js redirects / notFound propagate.
  if (err && typeof err === "object" && "digest" in err && typeof (err as { digest: unknown }).digest === "string") {
    const d = (err as { digest: string }).digest;
    if (d.startsWith("NEXT_REDIRECT") || d.startsWith("NEXT_HTTP_ERROR_FALLBACK")) throw err;
  }
  logger.error("action.unexpected_error", { err });
  return { ok: false, error: "generic" };
}

export function formObject(fd: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  return o;
}

/** Read `name.ku`, `name.ar`… style fields into { ku, ar, … }. */
export function localizedFromForm(fd: FormData, field: string) {
  const out: Record<string, string> = {};
  for (const l of ["ku", "ar", "en", "kmr"]) {
    const v = fd.get(`${field}.${l}`);
    if (typeof v === "string") out[l] = v;
  }
  return out;
}

export const emptyToNull = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() !== "" ? v : null);
