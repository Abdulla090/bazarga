/**
 * Social-first selling (docs/SOCIAL-FIRST.md): sellers keep posting on TikTok / Instagram / WhatsApp, and every link
 * they share carries `?src=<platform>` so Bazarga can tell them which platform actually sold.
 *
 * Pure helpers, safe on server and client. The allowlist is the single source of truth: the storefront capture
 * (src/components/store/SourceCapture.tsx), the checkout schema (src/lib/validation.ts), the view pixel and the
 * analytics all accept only these values.
 */
import type { Locale } from "./i18n";

export const ORDER_SOURCES = ["tiktok", "instagram", "whatsapp", "facebook", "telegram", "snapchat", "qr"] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

/**
 * Lower-cases and checks a raw `?src=` value against the allowlist; null when it is not on it. Deliberately zod-free
 * so the storefront bundle stays small; the server re-validates with zod (`orderSourceSchema`, src/lib/validation.ts).
 */
export function parseSource(raw: unknown): OrderSource | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase().slice(0, 20);
  return (ORDER_SOURCES as readonly string[]).includes(v) ? (v as OrderSource) : null;
}

/** Display names (brand names are not translated). */
export const SOURCE_LABEL: Record<OrderSource | "direct", string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  telegram: "Telegram",
  snapchat: "Snapchat",
  qr: "QR",
  direct: "Direct",
};

/** Chart colours per platform: blue/ink family only (no orange), TikTok darkest. */
export const SOURCE_COLOR: Record<OrderSource | "direct", string> = {
  tiktok: "#0a0a0b",
  instagram: "#2563eb",
  whatsapp: "#1f8a5b",
  facebook: "#1d4ed8",
  telegram: "#60a5fa",
  snapchat: "#93c5fd",
  qr: "#3f4654",
  direct: "#c7cdd6",
};

/** `url` with `src=<source>` set (replacing any existing one), keeping other params and the hash. */
export function withSource(url: string, source: OrderSource): string {
  const hashAt = url.indexOf("#");
  const hash = hashAt >= 0 ? url.slice(hashAt) : "";
  const base = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const [path, query = ""] = base.split("?", 2) as [string, string?];
  const params = new URLSearchParams(query);
  params.set("src", source);
  return `${path}?${params.toString()}${hash}`;
}

/** Public product page URL: `${APP_URL}/s/<slug>/p/<productId>`. */
export function productUrl(appUrl: string, slug: string, productId: string): string {
  return `${appUrl.replace(/\/+$/, "")}/s/${encodeURIComponent(slug)}/p/${encodeURIComponent(productId)}`;
}

/** Platforms the share kit offers a "copy link" for (snapchat/qr are attribution-only). */
export const SHARE_PLATFORMS = ["tiktok", "instagram", "whatsapp", "telegram", "facebook"] as const satisfies readonly OrderSource[];
export type SharePlatform = (typeof SHARE_PLATFORMS)[number];

export type CaptionLocale = Extract<Locale, "ku" | "ar" | "en">;
export const CAPTION_LOCALES: readonly CaptionLocale[] = ["ku", "ar", "en"];

const HASHTAGS: Record<CaptionLocale, string[]> = {
  ku: ["#کوردستان", "#هەولێر", "#سلێمانی", "#دهۆک", "#بازاڕ", "#فرۆشتنی_ئۆنلاین"],
  ar: ["#العراق", "#كردستان", "#أربيل", "#بغداد", "#تسوق_اونلاين", "#الدفع_عند_الاستلام"],
  en: ["#Kurdistan", "#Erbil", "#Iraq", "#ShopLocal", "#CashOnDelivery"],
};

/** Ready-to-paste post caption with price, store, how to order and hashtags. `link` is printed as-is. */
export function buildCaption(locale: CaptionLocale, p: { name: string; price: string; store: string; link: string }): string {
  const tags = HASHTAGS[locale].join(" ");
  const store = p.store.replace(/\s+/g, "");
  if (locale === "ku") {
    return `✨ ${p.name}\n💰 نرخ: ${p.price}\n🚚 گەیاندن بۆ هەموو شارەکان · پارە لە کاتی گەیاندندا\n🛒 داواکاری لێرەوە، پێویست بە DM ناکات:\n${p.link}\n\n${p.store}\n${tags} #${store}`;
  }
  if (locale === "ar") {
    return `✨ ${p.name}\n💰 السعر: ${p.price}\n🚚 توصيل لكل المحافظات · الدفع عند الاستلام\n🛒 اطلب مباشرة بدون رسائل خاصة:\n${p.link}\n\n${p.store}\n${tags} #${store}`;
  }
  return `✨ ${p.name}\n💰 Price: ${p.price}\n🚚 Delivery to every city · cash on delivery\n🛒 Order here, no DMs needed:\n${p.link}\n\n${p.store}\n${tags} #${store}`;
}

/** Share-kit image formats rendered on a canvas in the browser (src/lib/share-canvas.ts). */
export const SHARE_FORMATS = {
  story: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
} as const;
export type ShareFormat = keyof typeof SHARE_FORMATS;

/** "<slug>-<product8>-story.png" — safe download names. */
export function shareImageName(slug: string, productId: string, format: ShareFormat): string {
  const s = slug.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "store";
  return `${s}-${productId.replace(/[^a-z0-9]/gi, "").slice(0, 8)}-${format}.png`;
}

/** Storage key the storefront keeps the visit's source under (sessionStorage) / cookie name (7-day fallback). */
export const sourceStorageKey = (slug: string) => `bz:src:${slug}`;
export const sourceCookieName = (slug: string) => `bzsrc_${slug.replace(/[^a-z0-9-]/g, "")}`;
export const SOURCE_COOKIE_MAX_AGE = 7 * 86_400;
/** store_page_views.page key for "a visitor arrived from <source>" (counted once per visitor per day). */
export const sourcePage = (s: OrderSource) => `src:${s}`;
export function sourceFromPage(page: string): OrderSource | null {
  return page.startsWith("src:") ? parseSource(page.slice(4)) : null;
}

/** "https://x.app/s/a?src=tiktok" → "x.app/s/a?src=tiktok" for showing / printing (no uqr import, client-safe). */
export function displayLink(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}
