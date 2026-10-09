import { describe, expect, it } from "vitest";
import { mapsLink } from "@/lib/maps";

describe("mapsLink", () => {
  it("encodes and joins non-empty parts", () => {
    const u = mapsLink("Erbil", " ", null, "نزیک مزگەوت");
    expect(u).toBe("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Erbil, نزیک مزگەوت"));
  });
  it("never leaks raw spaces or ampersands", () => {
    expect(mapsLink("a&b c")).not.toMatch(/[ &]c/);
  });
});
