import { describe, expect, it } from "vitest";
import { guessLocale, localeFromAcceptLanguage, localeFromGeo } from "@/lib/geo-locale";

describe("localeFromGeo", () => {
  it("Kurdistan Region → Sorani", () => {
    expect(localeFromGeo("IQ", "AR")).toBe("ku");
    expect(localeFromGeo("IQ", "SU")).toBe("ku");
    expect(localeFromGeo("iq", "IQ-SU")).toBe("ku");
  });
  it("Duhok → Kurmanji", () => expect(localeFromGeo("IQ", "DA")).toBe("kmr"));
  it("Baghdad/Basra → Arabic", () => {
    expect(localeFromGeo("IQ", "BG")).toBe("ar");
    expect(localeFromGeo("IQ", "BA")).toBe("ar");
  });
  it("Iraq with unknown region keeps Kurdish", () => expect(localeFromGeo("IQ", "")).toBe("ku"));
  it("Turkey → Kurmanji, Gulf → Arabic", () => {
    expect(localeFromGeo("TR", "34")).toBe("kmr");
    expect(localeFromGeo("AE", "DU")).toBe("ar");
  });
  it("elsewhere → no guess", () => {
    expect(localeFromGeo("US", "CA")).toBeNull();
    expect(localeFromGeo(null, null)).toBeNull();
  });
});

describe("guessLocale", () => {
  it("falls back to Accept-Language outside known regions", () => {
    expect(guessLocale("DE", "BE", "de-DE,en;q=0.8")).toBe("en");
    expect(guessLocale("US", "", "ar-SA")).toBe("ar");
    expect(guessLocale("GB", "", "ckb")).toBe("ku");
  });
  it("geo wins over an English phone in Erbil", () => expect(guessLocale("IQ", "AR", "en-US")).toBe("ku"));
  it("nothing known → null (caller uses default)", () => expect(guessLocale("", "", "fr-FR")).toBeNull());
  it("parses q-values", () => expect(localeFromAcceptLanguage("fr;q=1, ar;q=0.9, en;q=0.5")).toBe("ar"));
});
