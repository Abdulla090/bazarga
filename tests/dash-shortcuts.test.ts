import { describe, it, expect } from "vitest";
import { goShortcutTarget, GO_SHORTCUTS, PALETTE_ITEMS } from "@/lib/dash-nav-items";

describe("go shortcuts", () => {
  it("maps keys case-insensitively", () => {
    expect(goShortcutTarget("O")).toBe("/dashboard/orders");
    expect(goShortcutTarget("z")).toBeNull();
  });
  it("only targets real dashboard pages", () => {
    const hrefs = PALETTE_ITEMS.map((i) => i.href as string);
    for (const v of Object.values(GO_SHORTCUTS)) expect(hrefs).toContain(v);
  });
});
