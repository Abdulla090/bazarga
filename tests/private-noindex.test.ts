import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("private areas are noindex", () => {
  for (const f of ["onboarding", "(auth)", "invite", "payments", "dashboard", "admin"]) {
    it(f, () => {
      expect(readFileSync(`src/app/${f}/layout.tsx`, "utf8")).toMatch(/index: false/);
    });
  }
});
