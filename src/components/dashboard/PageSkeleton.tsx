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

/* Skeleton for form-shaped dashboard pages (new/edit product, import, settings). */
export async function FormSkeleton() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="mx-auto w-full max-w-3xl space-y-5 p-4 md:p-6">
      <span className="sr-only">{t("loading")}</span>
      <div className="h-8 w-56 max-w-full animate-pulse rounded-lg bg-line motion-reduce:animate-none" />
      <div className="h-40 animate-pulse rounded-2xl bg-line motion-reduce:animate-none" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-28 animate-pulse rounded bg-line motion-reduce:animate-none" />
          <div className="h-11 animate-pulse rounded-xl bg-line motion-reduce:animate-none" />
        </div>
      ))}
      <div className="h-11 w-40 animate-pulse rounded-xl bg-line motion-reduce:animate-none" />
    </div>
  );
}
