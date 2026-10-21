import { getTranslations } from "next-intl/server";

/** Screen-reader label for skeleton placeholders (role="status" needs a name). */
export async function SrLoading() {
  const t = await getTranslations("common");
  return <span className="sr-only">{t("loading")}</span>;
}
