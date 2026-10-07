import { describe, expect, it } from "vitest";
import { maskIraqiMobile, normalizeIraqiMobile, phoneDisplay } from "@/lib/phone";

describe("normalizeIraqiMobile", () => {
  it.each([
    ["07501234567", "+9647501234567", "korek"],
    ["7501234567", "+9647501234567", "korek"],
    ["0770 123 4567", "+9647701234567", "asiacell"],
    ["+964 780 123 4567", "+9647801234567", "zain"],
    ["00964-790-123-4567", "+9647901234567", "zain"],
    ["9647501234567", "+9647501234567", "korek"],
    ["+9640750 123 4567", "+9647501234567", "korek"],
    ["٠٧٧٠١٢٣٤٥٦٧", "+9647701234567", "asiacell"],
    ["۰۷۸۰۱۲۳۴۵۶۷", "+9647801234567", "zain"],
    ["+٩٦٤ ٧٩٠ ١٢٣ ٤٥٦٧", "+9647901234567", "zain"],
  ])("%s → %s (%s)", (input, e164, operator) => {
    expect(normalizeIraqiMobile(input)).toEqual({ ok: true, e164, operator });
  });

  it.each([["07601234567"], ["07401234567"], ["07101234567"], ["+964 760 123 4567"]])("rejects unknown operator %s", (input) => {
    expect(normalizeIraqiMobile(input)).toEqual({ ok: false, reason: "phone_operator" });
  });

  it.each([["0750123456"], ["075012345678"], ["0650123456"], ["+49 151 23456789"], ["abc"], [""], ["0661234567"]])("rejects non-mobile %s", (input) => {
    expect(normalizeIraqiMobile(input)).toEqual({ ok: false, reason: "invalid_phone" });
  });
});

describe("maskIraqiMobile", () => {
  it.each([
    ["0", "0"],
    ["0750", "0750"],
    ["07501", "0750 1"],
    ["07501234567", "0750 123 4567"],
    ["075012345678999", "0750 123 4567"],
    ["750123", "0750 123"],
    ["٠٧٥٠١٢٣٤٥٦٧", "0750 123 4567"],
    ["+9647501234567", "+964 750 123 4567"],
    ["00964750", "+964 750"],
    ["+964", "+964"],
    ["", ""],
  ])("%s → %s", (input, out) => expect(maskIraqiMobile(input)).toBe(out));

  it("masked output always normalises", () => {
    expect(normalizeIraqiMobile(maskIraqiMobile("٠٧٩٠١٢٣٤٥٦٧"))).toMatchObject({ ok: true, e164: "+9647901234567" });
  });
});

describe("phoneDisplay", () => {
  it("adds exactly one +", () => {
    expect(phoneDisplay("9647501234567")).toBe("+9647501234567");
    expect(phoneDisplay("+9647501234567")).toBe("+9647501234567");
  });
});
