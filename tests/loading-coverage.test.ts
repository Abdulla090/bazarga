import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("loading states", () => {
  it.each(["dashboard/stores", "dashboard/team", "admin", "onboarding"])("%s has loading.tsx", (d) => {
    expect(existsSync(`src/app/${d}/loading.tsx`)).toBe(true);
  });
});
