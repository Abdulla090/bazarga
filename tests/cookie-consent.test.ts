import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("cookie notice", () => {
  it("has copy in all 4 locales", () => {
    for (const l of ["en", "ku", "kmr", "ar"]) {
      const c = JSON.parse(fs.readFileSync(`messages/${l}.json`, "utf8")).store.cookie;
      for (const k of ["title", "body", "accept", "decline"]) expect(c[k]).toBeTruthy();
    }
  });
});
