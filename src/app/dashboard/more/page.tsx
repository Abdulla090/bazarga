import { getTranslations } from "next-intl/server";
import { DashNav } from "@/components/dashboard/DashNav";
import { logOutAction } from "@/server/actions/auth";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { currentLocale } from "@/server/locale";
import { PendingButton } from "@/components/ui/PendingButton";

export default async function MorePage() {
  const t = await getTranslations("dash");
  const tc = await getTranslations("common");
  const locale = await currentLocale();
  return (
    <div className="grid gap-8">
      <h1 className="t-headline">{t("more")}</h1>
      <DashNav variant="more" />
      <div className="flex justify-center md:hidden"><LocaleSwitcher current={locale} /></div>
      <form action={logOutAction}>
        <PendingButton className="btn-ghost w-full">{tc("logout")}</PendingButton>
      </form>
    </div>
  );
}
