import type { Locale } from "@/lib/i18n";
import en from "../../messages/en.json";

type Json = { [k: string]: Json | string };

function deepMerge(base: Json, over: Json): Json {
  const out: Json = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (k.startsWith("_")) continue;
    const b = out[k];
    out[k] = typeof v === "object" && typeof b === "object" ? deepMerge(b, v) : v;
  }
  return out;
}

/** English is the base; every other locale overlays it, so a missing key never renders as a raw id. */
export async function loadMessages(locale: Locale): Promise<Json> {
  if (locale === "en") return en as Json;
  const mod = (await import(`../../messages/${locale}.json`)) as { default: Json };
  return deepMerge(en as Json, mod.default);
}
