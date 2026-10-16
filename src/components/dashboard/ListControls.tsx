import Link from "next/link";
import { ChevronBack, ChevronForward, Icon, Search } from "@/components/ui/icons";
import { listHref } from "@/lib/dash-list";

type Labels = { search: string; placeholder: string; clear: string; newer: string; older: string; showing: string };

/** GET search box for a dashboard list (works without JS; Enter submits). Keeps the current status filter. */
export function ListSearch({ base, q, status, labels, testId }: { base: string; q: string; status?: string; labels: Labels; testId: string }) {
  return (
    <form action={base} method="get" role="search" className="flex min-w-0 items-center gap-2" data-testid={testId}>
      {status && <input type="hidden" name="status" value={status} />}
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{labels.search}</span>
        <Icon as={Search} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-50" />
        <input type="search" name="q" defaultValue={q} placeholder={labels.placeholder} maxLength={64} enterKeyHint="search" autoComplete="off" className="input min-h-11 w-full ps-10" />
      </label>
      {q && <Link href={listHref(base, { status })} className="btn-ghost btn-sm shrink-0">{labels.clear}</Link>}
    </form>
  );
}

/** "51–100 of 1000" + Newer / Older links (page links keep the filter + query). Hidden when everything fits. */
export function ListPager({ base, page, pages, q, status, labels, testId }: { base: string; page: number; pages: number; q?: string; status?: string; labels: Labels; testId: string }) {
  if (pages <= 1) return <p className="num text-sm text-ink-70" data-testid={`${testId}-count`}>{labels.showing}</p>;
  const link = "btn-ghost btn-sm inline-flex min-h-11 items-center gap-1";
  const off = `${link} pointer-events-none opacity-40`;
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label={labels.showing} data-testid={testId}>
      <p className="num text-sm text-ink-70" data-testid={`${testId}-count`}>{labels.showing}</p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={listHref(base, { q, status, page: page - 1 })} rel="prev" className={link} data-testid={`${testId}-newer`}><ChevronBack /> {labels.newer}</Link>
        ) : (
          <span className={off} aria-disabled="true"><ChevronBack /> {labels.newer}</span>
        )}
        {page < pages ? (
          <Link href={listHref(base, { q, status, page: page + 1 })} rel="next" className={link} data-testid={`${testId}-older`}>{labels.older} <ChevronForward /></Link>
        ) : (
          <span className={off} aria-disabled="true">{labels.older} <ChevronForward /></span>
        )}
      </div>
    </nav>
  );
}
