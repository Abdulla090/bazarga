import Link from "next/link";
import { FoundingBadge } from "@/components/FoundingBadge";
import { buildSrcSet } from "@/lib/responsive-image";
import type { ShowcaseStore } from "@/lib/showcase";

export type ShowcaseCardLabels = { products: string; demo: string; visit: string; founding: string };

/** One store tile on /showcase (docs/DEMAND.md D4): cover photo, name, tagline, city, product count. The whole card is one link. */
export function ShowcaseCard({ store, tagline, city, l, priority = false }: { store: ShowcaseStore; tagline: string; city: string; l: ShowcaseCardLabels; priority?: boolean }) {
  const initial = Array.from(store.name.trim())[0]?.toUpperCase() ?? "B";
  return (
    <Link
      href={`/s/${store.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-paper transition-shadow hover:shadow-[0_8px_30px_-12px_rgba(10,10,10,0.25)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
      data-testid="showcase-card"
      data-slug={store.slug}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#F4F4F5]" style={store.coverPlaceholder ? { backgroundImage: `url("${store.coverPlaceholder}")`, backgroundSize: "cover" } : undefined}>
        {store.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={store.coverUrl}
            srcSet={buildSrcSet(store.coverRenditions)}
            sizes={store.coverRenditions.length ? "(min-width: 1024px) 380px, (min-width: 640px) 45vw, 92vw" : undefined}
            alt=""
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <span aria-hidden className="grid h-full place-items-center text-5xl font-light text-ink-70">{initial}</span>
        )}
        {store.isDemo && (
          <span className="absolute start-3 top-3 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper">{l.demo}</span>
        )}
      </div>
      <div className="grid gap-2 p-4">
        <h3 className="text-lg font-semibold leading-snug">{store.name}</h3>
        {tagline && <p className="line-clamp-2 text-sm text-ink-70">{tagline}</p>}
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-70">
          {city && <span>{city}</span>}
          {city && <span aria-hidden>·</span>}
          <span>{l.products.replace("{n}", new Intl.NumberFormat("en-US").format(store.productCount))}</span>
        </p>
        <div className="mt-1 flex min-h-11 items-center justify-between gap-2">
          {store.foundingNumber ? <FoundingBadge label={l.founding} number={store.foundingNumber} /> : <span />}
          <span className="text-sm font-semibold text-[#2563EB]">{l.visit} <span aria-hidden className="inline-block rtl:rotate-180">→</span></span>
        </div>
      </div>
    </Link>
  );
}
