import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("public page loading states", () => {
  it.each(["s/[slug]/order/[publicId]", "invite/[token]", "(marketing)/waitlist/[code]"])("%s has a loading skeleton", (p) => {
    expect(existsSync(path.join(process.cwd(), "src/app", p, "loading.tsx"))).toBe(true);
  });
});
