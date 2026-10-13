import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/LegalPage";

export async function generateMetadata() {
  const t = await getTranslations("legal");
  return { title: t("privacy") };
}

export default function Page() {
  return <LegalPage slug="privacy" />;
}
