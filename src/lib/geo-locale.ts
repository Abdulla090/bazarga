import { isLocale, type Locale } from "@/lib/i18n";

/** Request header (set by the proxy, never trusted from the client) carrying the locale guessed from the visitor's IP. */
export const GEO_LOCALE_HEADER = "x-mm-geo-locale";

/** Kurdistan Region of Iraq + Kurdish-majority areas → Sorani; Duhok (Badini) → Kurmanji. Region codes are ISO 3166-2 suffixes as Vercel sends them. */
const IQ_SORANI = new Set(["AR", "SU", "KI", "HA", "SW"]); // Erbil, Sulaymaniyah, Kirkuk, Halabja (codes vary)
const IQ_KURMANJI = new Set(["DA"]); // Duhok
const IR_SORANI = new Set(["16", "05", "12", "KD", "KE"]); // Kurdistan, Kermanshah, Ilam
const KURMANJI_COUNTRIES = new Set(["TR", "AM", "GE"]);
const ARAB_COUNTRIES = new Set(["IQ", "SA", "AE", "KW", "QA", "BH", "OM", "YE", "JO", "LB", "SY", "PS", "EG", "LY", "TN", "DZ", "MA", "SD", "MR"]);

/** Language from the visitor's IP location (no browser permission needed — the hosting edge already knows the country/region). */
export function localeFromGeo(country?: string | null, region?: string | null): Locale | null {
  const c = (country ?? "").trim().toUpperCase();
  const r = decodeURIComponent((region ?? "").trim()).toUpperCase().replace(/^[A-Z]{2}-/, "");
  if (!c) return null;
  if (c === "IQ") {
    if (IQ_KURMANJI.has(r)) return "kmr";
    if (IQ_SORANI.has(r)) return "ku";
    return r ? "ar" : "ku"; // unknown region inside Iraq: keep the Kurdish-first default
  }
  if (c === "IR") return IR_SORANI.has(r) ? "ku" : null;
  if (c === "SY" && r === "HA") return "kmr"; // Hasakah
  if (KURMANJI_COUNTRIES.has(c)) return "kmr";
  if (ARAB_COUNTRIES.has(c)) return "ar";
  return null;
}

/** Best match from the browser's Accept-Language list. */
export function localeFromAcceptLanguage(header?: string | null): Locale | null {
  if (!header) return null;
  const tags = header
    .split(",")
    .map((p) => {
      const [tag, ...params] = p.trim().split(";");
      const q = params.find((x) => x.trim().startsWith("q="));
      return { tag: (tag ?? "").toLowerCase(), q: q ? Number(q.trim().slice(2)) || 0 : 1 };
    })
    .filter((t) => t.tag)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    const base = tag.split("-")[0]!;
    if (base === "ckb" || tag === "ku-iq" || tag === "ku-arab") return "ku";
    if (base === "kmr" || base === "ku") return base === "ku" && tag.includes("arab") ? "ku" : "kmr";
    if (base === "ar") return "ar";
    if (base === "en") return "en";
  }
  return null;
}

/** IP location first (most accurate for Kurdistan, where phones are often set to English), then the browser language. */
export function guessLocale(country?: string | null, region?: string | null, acceptLanguage?: string | null): Locale | null {
  const geo = localeFromGeo(country, region);
  if (geo) return geo;
  const al = localeFromAcceptLanguage(acceptLanguage);
  return isLocale(al) ? al : null;
}
