import { describe, expect, it } from "vitest";
import { InstantSearch } from "@/components/store/InstantSearch";
describe("InstantSearch", () => {
  it("is a component that renders nothing", () => {
    expect(typeof InstantSearch).toBe("function");
    expect(InstantSearch({ formId: "x" })).toBeNull();
  });
});
