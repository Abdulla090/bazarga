"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { parseRecent, pushRecent, recentKey, type RecentItem } from "@/lib/recently-viewed";

/** Records this product locally and shows the other products the shopper looked at before (this browser only). */
export function RecentlyViewed({ slug, item, heading }: { slug: string; item: RecentItem; heading: string }) {
  const [others, setOthers] = useState<RecentItem[]>([]);
  useEffect(() => {
    try {
      const prev = parseRecent(localStorage.getItem(recentKey(slug)));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser-only storage after mount
      setOthers(prev.filter((x) => x.id !== item.id).slice(0, 6));
      localStorage.setItem(recentKey(slug), JSON.stringify(pushRecent(prev, item)));
    } catch {
      /* storage blocked: skip silently */
    }
  }, [slug, item]);
  if (others.length === 0) return null;
  return (
    <section aria-label={heading} className="grid gap-3" data-testid="recently-viewed">
      <h2 className="text-base font-semibold text-st-fg">{heading}</h2>
      <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
        {others.map((o) => (
          <li key={o.id} className="w-32 shrink-0 snap-start">
            <Link href={`/s/${slug}/p/${o.id}`} className="block min-h-11">
              <div className="aspect-[4/5] overflow-hidden rounded-lg bg-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element -- small local thumb */}
                {o.img ? <img src={o.img} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : null}
              </div>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-st-fg">{o.name}</p>
              <p className="text-sm text-muted">{o.price}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
