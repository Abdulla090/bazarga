export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "OUT_OF_STOCK"
  | "UNAVAILABLE"
  | "PAYMENT_ERROR";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  OUT_OF_STOCK: 409,
  UNAVAILABLE: 503,
  PAYMENT_ERROR: 502,
};

/** An expected, user-facing error. `code` maps to an i18n key `errors.<code>`. */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message ?? code);
    this.name = "AppError";
  }
  get status() {
    return STATUS[this.code];
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;
