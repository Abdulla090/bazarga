import { describe, expect, it } from "vitest";
import { parseDetails, serializeDetails } from "@/lib/saved-details";

describe("saved details", () => {
  it("round-trips and trims", () => {
    const raw = serializeDetails({ name: " Aso ", phone: "0750 123 4567", landmark: "Near mosque" });
    expect(parseDetails(raw)).toEqual({ name: "Aso", phone: "0750 123 4567", landmark: "Near mosque" });
  });
  it("rejects junk and empties", () => {
    expect(parseDetails(null)).toBeNull();
    expect(parseDetails("not json")).toBeNull();
    expect(parseDetails(serializeDetails({}))).toBeNull();
  });
  it("caps lengths", () => {
    expect(parseDetails(JSON.stringify({ name: "x".repeat(500) }))!.name.length).toBe(80);
  });
});
