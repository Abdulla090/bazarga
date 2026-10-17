import { describe, expect, it } from "vitest";
import { parseRecent, pushRecent, RECENT_MAX } from "@/lib/recently-viewed";
const mk = (id: string) => ({ id, name: id, img: null, price: "1" });
describe("recently viewed", () => {
  it("puts newest first, dedupes, caps", () => {
    let l = [] as ReturnType<typeof parseRecent>;
    for (let i = 0; i < 12; i++) l = pushRecent(l, mk(String(i)));
    l = pushRecent(l, mk("5"));
    expect(l[0]?.id).toBe("5");
    expect(l.length).toBe(RECENT_MAX);
    expect(l.filter((x) => x.id === "5").length).toBe(1);
  });
  it("parses safely", () => {
    expect(parseRecent("nope")).toEqual([]);
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent(JSON.stringify([mk("a"), { id: 1 }]))).toEqual([mk("a")]);
  });
});
