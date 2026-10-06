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
