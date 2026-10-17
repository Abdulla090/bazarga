import { describe, expect, it } from "vitest";
import { PALETTE_ITEMS, filterPalette } from "@/lib/dash-nav-items";
describe("palette", () => {
  const items = PALETTE_ITEMS.map((i) => ({ href: i.href, label: i.key }));
  it("filters case-insensitively", () => expect(filterPalette(items, " ORD ").map((i) => i.href)).toEqual(["/dashboard/orders"]));
  it("returns all for empty query", () => expect(filterPalette(items, "")).toHaveLength(items.length));
});
