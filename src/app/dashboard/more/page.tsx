import { getTranslations } from "next-intl/server";
import { DashNav } from "@/components/dashboard/DashNav";
import { logOutAction } from "@/server/actions/auth";

export default async function MorePage() {
  const t = await getTranslations("dash");
  const tc = await getTranslations("common");
  return (
    <div className="grid gap-8">
      <h1 className="t-headline">{t("more")}</h1>
      <DashNav variant="more" />
      <form action={logOutAction}>
        <button className="btn-ghost w-full">{tc("logout")}</button>
      </form>
    </div>
  );
}
