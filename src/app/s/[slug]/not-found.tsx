import { getTranslations } from "next-intl/server";
import { StoreHomeLink } from "@/components/store/StoreHomeLink";

// Storefront 404 (a missing product or page inside a store): same shape as the error state — one display-type
// statement and one action — inside the store's own header and footer instead of the bare platform 404.
export default async function StoreNotFound() {
  const t = await getTranslations("store");
  return (
    <div className="mx-auto grid max-w-xl justify-items-center gap-6 py-16 text-center sm:py-24" data-testid="store-not-found">
      <p className="t-label section-index">404</p>
      <h1 className="t-display">{t("pageNotFound")}</h1>
      <StoreHomeLink className="btn-gold min-h-12 px-8">{t("continue")}</StoreHomeLink>
    </div>
  );
}
