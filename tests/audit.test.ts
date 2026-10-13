import { describe, expect, it } from "vitest";
import { auditDetail } from "../src/server/audit";

describe("auditDetail", () => {
  it("keeps only safe field names, sorted and de-duplicated", () => {
    expect(auditDetail(["slug", "name", "slug", "pass word", "x".repeat(50)])).toBe("name,slug");
  });
  it("caps at 20 fields", () => {
    expect(auditDetail(Array.from({ length: 30 }, (_, i) => `f${i}`)).split(",").length).toBe(20);
  });
});
