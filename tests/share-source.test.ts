import { describe, expect, it } from "vitest";
import { withSource } from "@/lib/social";
describe("share link attribution", () => {
  it("tags WhatsApp shares", () => {
    expect(withSource("https://x.app/s/a/p/1", "whatsapp")).toBe("https://x.app/s/a/p/1?src=whatsapp");
  });
});
