"use client";
import { useCallback, useSyncExternalStore } from "react";

export type CartLine = { productId: string; quantity: number };

const key = (slug: string) => `mm_cart_${slug}`;
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: CartLine[] }>();
const EMPTY: CartLine[] = [];

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
        .filter((l): l is CartLine => !!l && typeof l.productId === "string" && Number.isInteger(l.quantity) && l.quantity > 0)
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
  const add = useCallback((productId: string, qty = 1) => {
    const cur = read(slug);
    const found = cur.find((l) => l.productId === productId);
    write(slug, found ? cur.map((l) => (l.productId === productId ? { ...l, quantity: Math.min(99, l.quantity + qty) } : l)) : [...cur, { productId, quantity: qty }]);
  }, [slug]);
  const setQty = useCallback((productId: string, quantity: number) => {
    const cur = read(slug);
    write(slug, quantity <= 0 ? cur.filter((l) => l.productId !== productId) : cur.map((l) => (l.productId === productId ? { ...l, quantity: Math.min(99, quantity) } : l)));
  }, [slug]);
  const clear = useCallback(() => write(slug, []), [slug]);
  const count = lines.reduce((a, l) => a + l.quantity, 0);
  return { lines, add, setQty, clear, count };
}
