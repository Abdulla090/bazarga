import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("marketing loading boundaries", () => {
  it("landing is not wrapped in a Suspense skeleton (no-JS users must see content)", () => {
    expect(existsSync("src/app/(marketing)/loading.tsx")).toBe(false);
  });
  it("subpages keep skeletons", () => {
    for (const d of ["pricing", "showcase", "waitlist"]) expect(existsSync(`src/app/(marketing)/${d}/loading.tsx`)).toBe(true);
  });
});
