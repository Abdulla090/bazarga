import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("loading states", () => {
  it.each(["dashboard/stores", "dashboard/team", "admin", "onboarding"])("%s has loading.tsx", (d) => {
    expect(existsSync(`src/app/${d}/loading.tsx`)).toBe(true);
  });
});

describe("shopper/invite loading states", () => {
  it.each(["invite", "s/[slug]/cart", "s/[slug]/track", "s/[slug]/order"])("%s has loading.tsx", (d) => {
    expect(existsSync(`src/app/${d}/loading.tsx`)).toBe(true);
  });
});

describe("legal page loading states", () => {
  it.each(["privacy", "terms", "refund"])("(marketing)/%s has loading.tsx", (d) => {
    expect(existsSync(`src/app/(marketing)/${d}/loading.tsx`)).toBe(true);
  });
});
