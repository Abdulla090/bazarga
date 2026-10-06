import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { visionProvider } from "@/server/ai";
import { AiBuilder } from "./AiBuilder";

export default async function AiPage() {
  await requireStore();
  const t = await getTranslations("ai");
  const enabled = !!visionProvider();
  return (
    <div className="grid max-w-3xl gap-4">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="text-ink-70">{t("sub")}</p>
      {enabled ? <AiBuilder /> : <p className="card bg-gold/10 font-semibold">{t("disabled")}</p>}
    </div>
  );
}
