import type { MerchBadgeLabels } from "./MerchBadges";
import type { OfferBannerLabels } from "./OfferBanner";

type T = { (key: string): string; raw(key: string): unknown };

/** Pre-translated badge strings (the storefront ships no i18n runtime to the browser). */
export function merchLabels(t: T): MerchBadgeLabels {
  return { bestSeller: t("bestSeller"), new: t("badgeNew"), featured: t("badgeFeatured") };
}

/** Offer-banner templates; `{pct}` / `{amount}` / `{code}` are filled by the banner. */
export function offerLabels(t: T): OfferBannerLabels {
  return {
    percent: t.raw("offerPercent") as string,
    fixed: t.raw("offerFixed") as string,
    freeDelivery: t.raw("offerFreeDelivery") as string,
    min: t.raw("offerMin") as string,
    howTo: t("offerHowTo"),
    label: t("offerLabel"),
    copy: t("copyCode"),
    copied: t("codeCopied"),
  };
}
