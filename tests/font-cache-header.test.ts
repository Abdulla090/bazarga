import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("fonts are cached 30 days with long stale-while-revalidate", () => {
  const src = readFileSync("next.config.ts", "utf8");
  expect(src).toMatch(/\/fonts\/:path\*[^\n]*max-age=2592000, stale-while-revalidate=31536000/);
});
