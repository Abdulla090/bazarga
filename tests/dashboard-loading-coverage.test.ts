import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard loading states", () => {
  it.each(["orders/[id]/slip", "orders/courier", "orders", "products", "settings"])("%s has a loading skeleton", (p) => {
    expect(existsSync(path.join(process.cwd(), "src/app/dashboard", p, "loading.tsx"))).toBe(true);
  });
});
