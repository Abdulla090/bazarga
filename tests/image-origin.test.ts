import { describe, expect, it } from "vitest";
import { imageOrigin } from "@/lib/image-origin";

describe("imageOrigin", () => {
  it("returns the https origin", () => {
    expect(imageOrigin("https://pub-abc.r2.dev/uploads")).toBe("https://pub-abc.r2.dev");
  });
  it("ignores empty, http and invalid values", () => {
    expect(imageOrigin(undefined)).toBeNull();
    expect(imageOrigin("")).toBeNull();
    expect(imageOrigin("http://x.test")).toBeNull();
    expect(imageOrigin("nope")).toBeNull();
  });
});
