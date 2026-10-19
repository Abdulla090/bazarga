import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("store home canonical", () => {
  it("store home page exports a canonical alternate", () => {
    const s = readFileSync("src/app/s/[slug]/page.tsx", "utf8");
    expect(s).toContain("export async function generateMetadata");
    expect(s).toContain("canonical:");
  });
});
