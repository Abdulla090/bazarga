import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("loading skeletons are localized", () => {
  for (const f of ["src/app/admin/loading.tsx", "src/app/onboarding/loading.tsx", "src/components/dashboard/PageSkeleton.tsx"]) {
    it(f, () => {
      const s = readFileSync(f, "utf8");
      expect(s).not.toContain("Loading…");
      expect(s).toContain('t("loading")');
    });
  }
});
