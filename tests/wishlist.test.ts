import { describe, expect, it } from "vitest";
import { hasWish, parseWish, toggleWish, WISH_MAX } from "@/lib/wishlist";
const it1: { id: string; name: string; img: string | null; price: string } = { id: "a", name: "A", img: null, price: "1,000" };
describe("wishlist", () => {
  it("toggles on and off", () => {
    const on = toggleWish([], it1);
    expect(hasWish(on, "a")).toBe(true);
    expect(toggleWish(on, it1)).toEqual([]);
  });
  it("caps and parses safely", () => {
    let l: typeof it1[] = [];
    for (let i = 0; i < WISH_MAX + 5; i++) l = toggleWish(l, { ...it1, id: String(i) });
    expect(l.length).toBe(WISH_MAX);
    expect(parseWish("nope")).toEqual([]);
    expect(parseWish(JSON.stringify(l)).length).toBe(WISH_MAX);
  });
});
