import { getTranslations } from "next-intl/server";
export default async function Loading() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className="space-y-4 p-4">
      <span className="sr-only">{t("loading")}</span>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200/70 motion-reduce:animate-none" />
      <div className="h-40 animate-pulse rounded-2xl bg-slate-200/60 motion-reduce:animate-none" />
      <div className="h-64 animate-pulse rounded-2xl bg-slate-200/50 motion-reduce:animate-none" />
    </div>
  );
}
