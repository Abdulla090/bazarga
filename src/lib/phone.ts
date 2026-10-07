const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

/** Convert Eastern Arabic / Persian digits to ASCII. Customers often type ٠٧٥٠… */
export function toAsciiDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (d) => ARABIC_DIGITS[d] ?? d);
}

/**
 * Normalise an Iraqi mobile number to international digits without "+": 9647XXXXXXXXX.
 * Accepts 07XX…, 7XX…, +964 7XX…, 00964 7XX…. Returns null when it does not look like an Iraqi mobile.
 * Non-Iraqi international numbers (diaspora sellers) are accepted when given with + or 00.
 */
export function normalizePhone(input: string): string | null {
  const raw = toAsciiDigits(input).trim();
  const hasPlus = raw.startsWith("+") || raw.startsWith("00");
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("964")) d = d.slice(3);
  else if (hasPlus) return d.length >= 8 && d.length <= 15 ? d : null;
  if (d.startsWith("0")) d = d.slice(1);
  if (/^7\d{9}$/.test(d)) return `964${d}`;
  return null;
}

// ---------------------------------------------------------------- Iraqi mobile (checkout)
/** Mobile prefixes after 07: 75 Korek, 77 Asiacell, 78/79 Zain. Anything else is rejected at checkout. */
export const IRAQI_OPERATORS = { "75": "korek", "77": "asiacell", "78": "zain", "79": "zain" } as const;
export type IraqiOperator = (typeof IRAQI_OPERATORS)[keyof typeof IRAQI_OPERATORS];

export type IraqiMobileResult =
  | { ok: true; e164: string; operator: IraqiOperator }
  | { ok: false; reason: "invalid_phone" | "phone_operator" };

/** Strip formatting and any 00964 / +964 / 964 / 0 prefix → the 10 national digits "7XXXXXXXXX" (or whatever is left). */
function nationalDigits(input: string): string {
  let d = toAsciiDigits(input).replace(/\D/g, "");
  if (d.startsWith("00964")) d = d.slice(5);
  else if (d.startsWith("964") && d.length > 10) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d;
}

/**
 * Normalise an Iraqi mobile to E.164 "+9647XXXXXXXXX". Accepts 07XX…, 7XX…, +964…, 00964…, 964…,
 * with spaces/dashes and Eastern Arabic / Persian (Kurdish) digits. Rejects non-mobiles and unknown operators.
 */
export function normalizeIraqiMobile(input: string): IraqiMobileResult {
  const d = nationalDigits(input);
  if (!/^7\d{9}$/.test(d)) return { ok: false, reason: "invalid_phone" };
  const operator = IRAQI_OPERATORS[d.slice(0, 2) as keyof typeof IRAQI_OPERATORS];
  if (!operator) return { ok: false, reason: "phone_operator" };
  return { ok: true, e164: `+964${d}`, operator };
}

/**
 * Input mask for the checkout phone field: converts Arabic/Kurdish digits to ASCII and groups as the shopper types,
 * "0750 123 4567" (or "+964 750 123 4567" when they started with the country code). Never blocks typing.
 */
export function maskIraqiMobile(raw: string): string {
  const ascii = toAsciiDigits(raw);
  const intl = /^\s*(\+|00)/.test(ascii);
  let d = ascii.replace(/\D/g, "");
  if (intl) {
    if (d.startsWith("00")) d = d.slice(2);
    if (d.startsWith("964")) d = d.slice(3);
    if (d.startsWith("0")) d = d.slice(1);
    d = d.slice(0, 10);
    const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean);
    return ["+964", ...parts].join(" ").trimEnd();
  }
  if (d.startsWith("7")) d = `0${d}`;
  d = d.slice(0, 11);
  return [d.slice(0, 4), d.slice(4, 7), d.slice(7, 11)].filter(Boolean).join(" ");
}

/** Display a stored phone ("9647…" legacy or "+9647…") with exactly one leading "+". */
export function phoneDisplay(stored: string): string {
  return `+${stored.replace(/^\+/, "")}`;
}
