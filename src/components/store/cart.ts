"use client";
import { useCallback, useSyncExternalStore } from "react";

/** One cart line. `variantId` is set for products with variants (size / colour); the server re-checks it. */
export type CartLine = { productId: string; variantId: string | null; quantity: number };
export type LineRef = { productId: string; variantId?: string | null };

const key = (slug: string) => `mm_cart_${slug}`;
export const lineKey = (l: LineRef) => `${l.productId}:${l.variantId ?? ""}`;
const same = (a: LineRef, b: LineRef) => lineKey(a) === lineKey(b);

const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: CartLine[] }>();
const EMPTY: CartLine[] = [];
const ID = /^[0-9a-f-]{36}$/i;

function read(slug: string): CartLine[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(key(slug));
  const hit = cache.get(slug);
  if (hit && hit.raw === raw) return hit.value;
  let value: CartLine[] = EMPTY;
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(parsed)) {
      value = parsed
        .filter(
          (l): l is CartLine =>
            !!l &&
            typeof l.productId === "string" &&
            ID.test(l.productId) &&
            (l.variantId == null || (typeof l.variantId === "string" && ID.test(l.variantId))) &&
            Number.isInteger(l.quantity) &&
            l.quantity > 0,
        )
        // v1 carts stored no variantId.
        .map((l) => ({ productId: l.productId, variantId: l.variantId ?? null, quantity: Math.min(99, l.quantity) }))
        .slice(0, 50);
    }
  } catch {
    value = EMPTY;
  }
  cache.set(slug, { raw, value });
  return value;
}

function write(slug: string, lines: CartLine[]) {
  window.localStorage.setItem(key(slug), JSON.stringify(lines));
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = () => cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Per-store cart in localStorage. Prices are never stored client-side — the server quotes them. */
export function useCart(slug: string) {
  const lines = useSyncExternalStore(subscribe, () => read(slug), () => EMPTY);
  const add = useCallback(
    (ref: LineRef, qty = 1) => {
      const cur = read(slug);
      const found = cur.find((l) => same(l, ref));
      write(
        slug,
        found
          ? cur.map((l) => (same(l, ref) ? { ...l, quantity: Math.min(99, l.quantity + qty) } : l))
          : [...cur, { productId: ref.productId, variantId: ref.variantId ?? null, quantity: qty }],
      );
    },
    [slug],
  );
  const setQty = useCallback(
    (ref: LineRef, quantity: number) => {
      const cur = read(slug);
      write(slug, quantity <= 0 ? cur.filter((l) => !same(l, ref)) : cur.map((l) => (same(l, ref) ? { ...l, quantity: Math.min(99, quantity) } : l)));
    },
    [slug],
  );
  const clear = useCallback(() => write(slug, []), [slug]);
  const count = lines.reduce((a, l) => a + l.quantity, 0);
  return { lines, add, setQty, clear, count };
}
