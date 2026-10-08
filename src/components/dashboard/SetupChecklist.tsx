import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { SetupChecklist as Checklist } from "@/lib/setup-checklist";
import { confirmDeliveryFeesAction } from "@/server/actions/setup";
import { ShareLinkButtons } from "./ShareLinkButtons";
import { Check, ChevronForward, Icon } from "@/components/ui/icons";

/** Dashboard-home setup checklist. Server-rendered; hidden once every step is done. */
export async function SetupChecklist({ checklist, storeUrl, storeName }: { checklist: Checklist; storeUrl: string; storeName: string }) {
  if (checklist.complete) return null;
  const t = await getTranslations("setup");
  const pct = Math.round((checklist.doneCount / checklist.total) * 100);
  return (
    <section className="card" aria-labelledby="setup-title" data-testid="setup-checklist">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="setup-title" className="text-lg font-bold">{t("title")}</h2>
        <p className="text-sm font-semibold text-ink-70">
          {t("progress", { done: checklist.doneCount, total: checklist.total })}
        </p>
      </div>
      <p className="text-sm text-ink-70">{t("subtitle")}</p>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={checklist.total}
        aria-valuenow={checklist.doneCount}
        aria-labelledby="setup-title"
      >
        <div className="h-full rounded-full bg-green" style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-4 grid gap-2">
        {checklist.steps.map((s) => {
          const isNext = s.key === checklist.next;
          return (
            <li
              key={s.key}
              data-step={s.key}
              data-done={s.done || undefined}
              className={`flex items-start gap-3 rounded-xl border p-3 ${isNext ? "border-ink" : "border-line"}`}
            >
              <span
                className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${s.done ? "border-green bg-green text-white" : "border-line"}`}
              >
                {s.done && <Icon as={Check} label={t("done")} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${s.done ? "text-ink-50 line-through" : ""}`}>{t(`${s.key}.title`)}</p>
                {!s.done && (
                  <>
                    <p className="text-sm text-ink-70">{t(`${s.key}.desc`)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {s.key === "share" ? (
                        <>
                          <ShareLinkButtons url={storeUrl} title={storeName} variant={isNext ? "ink" : "ghost"} />
                          <Link href={s.href} className="btn-ghost btn-sm" data-testid="setup-share-kit">
                            {t("share.cta")} <ChevronForward />
                          </Link>
                        </>
                      ) : (
                        <Link href={s.href} className={isNext ? "btn-ink btn-sm" : "btn-ghost btn-sm"}>
                          {t(`${s.key}.cta`)} <ChevronForward />
                        </Link>
                      )}
                      {s.key === "delivery" && (
                        <form action={confirmDeliveryFeesAction}>
                          <button className="btn-ghost btn-sm">{t("delivery.confirm")}</button>
                        </form>
                      )}
                    </div>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
