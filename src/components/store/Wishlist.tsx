"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { hasWish, parseWish, toggleWish, wishKey, type WishItem } from "@/lib/wishlist";

/** Heart toggle for this product plus the shopper's other saved products (this browser only). */
export function Wishlist({ slug, item, labels }: { slug: string; item: WishItem; labels: { save: string; saved: string; heading: string } }) {
  const [list, setList] = useState<WishItem[]>([]);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser-only storage after mount
      setList(parseWish(localStorage.getItem(wishKey(slug))));
    } catch {
      /* storage blocked */
    }
  }, [slug]);
  const on = hasWish(list, item.id);
  const toggle = () => {
    const next = toggleWish(list, item);
    setList(next);
    try {
      localStorage.setItem(wishKey(slug), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  const others = list.filter((x) => x.id !== item.id);
  return (
    <section aria-label={labels.heading} className="grid gap-3" data-testid="wishlist">
      <button type="button" onClick={toggle} aria-pressed={on} className="btn-ghost inline-flex min-h-11 w-fit items-center gap-2 px-4" data-testid="wishlist-toggle">
        <svg width="18" height="18" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 21s-7-4.6-9.3-9.2C1.3 8.6 3 5 6.4 5c2 0 3.6 1.1 4.6 2.7C12 6.1 13.6 5 15.6 5 19 5 20.7 8.6 21.3 11.8 19 16.4 12 21 12 21z" />
        </svg>
        <span className="leading-relaxed">{on ? labels.saved : labels.save}</span>
      </button>
      {others.length > 0 && (
        <>
          <h2 className="text-base font-semibold text-st-fg">{labels.heading}</h2>
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
        </>
      )}
    </section>
  );
}
