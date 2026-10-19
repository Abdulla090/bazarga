import { getTranslations } from "next-intl/server";
/* Loading skeleton shared by dashboard routes. Logical CSS only; motion respects prefers-reduced-motion. */
export async function PageSkeleton() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
      <span className="sr-only">{t("loading")}</span>
      <div className="h-8 w-48 max-w-full animate-pulse rounded-lg bg-line motion-reduce:animate-none" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-24 animate-pulse rounded-xl bg-line motion-reduce:animate-none" />
        <div className="h-24 animate-pulse rounded-xl bg-line motion-reduce:animate-none" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-line motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}
