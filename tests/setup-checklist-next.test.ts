import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("setup checklist next-step marker", () => {
  it("marks the next step with aria-current and a logical-edge accent (RTL safe)", () => {
    const src = readFileSync("src/components/dashboard/SetupChecklist.tsx", "utf8");
    expect(src).toContain('aria-current={isNext ? "step" : undefined}');
    expect(src).toContain("border-s-gold");
    expect(src).not.toContain('${isNext ? "" : ""}');
  });
});
