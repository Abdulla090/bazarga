import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("order detail loading", () => {
  it("has its own form-shaped skeleton", () => {
    const p = "src/app/dashboard/orders/[id]/loading.tsx";
    expect(existsSync(p)).toBe(true);
    expect(readFileSync(p, "utf8")).toContain("FormSkeleton");
  });
});
