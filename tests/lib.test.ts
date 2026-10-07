import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/phone";
import { isValidSlug, slugify } from "@/lib/slug";
import { orderSummaryText, waLink } from "@/lib/whatsapp";
import { pickText } from "@/lib/i18n";
import { canTransition } from "@/lib/order-status";
import { checkoutSchema, productSchema, storeSchema } from "@/lib/validation";
import { sniffImage, validateImage } from "@/server/storage/image";
import { MockVision, parseDrafts } from "@/server/ai";
import ku from "../messages/ku.json";
import ar from "../messages/ar.json";
import en from "../messages/en.json";

describe("phone", () => {
  it.each([
    ["07501234567", "9647501234567"],
    ["0750 123 4567", "9647501234567"],
    ["+964 750 123 4567", "9647501234567"],
    ["00964-750-123-4567", "9647501234567"],
    ["٠٧٥٠١٢٣٤٥٦٧", "9647501234567"],
    ["+49 151 23456789", "4915123456789"],
  ])("%s → %s", (i, o) => expect(normalizePhone(i)).toBe(o));
  it("rejects junk", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("0650123456")).toBeNull();
  });
});

describe("slug", () => {
  it("slugifies and validates", () => {
    expect(slugify("Hawler Bazaar!")).toBe("hawler-bazaar");
    expect(slugify("بازاڕی هەولێر")).toBe("");
    expect(isValidSlug("hawler-bazaar")).toBe(true);
    expect(isValidSlug("admin")).toBe(false);
    expect(isValidSlug("-bad")).toBe(false);
  });
});

describe("whatsapp", () => {
  it("builds a wa.me link with an encoded order summary", () => {
    const text = orderSummaryText(
      {
        storeName: "Hawler Bazaar",
        orderNumber: 1001,
        items: [{ name: "Kurdish dress", quantity: 1, lineTotal: 85000 }],
        subtotal: 85000,
        deliveryFee: 3000,
        total: 88000,
        customerName: "Shilan",
        cityName: "Erbil",
        address: "Near the Bazaar Mosque",
        paymentLabel: "Cash on delivery",
      },
      "en",
    );
    expect(text).toContain("Order #1001");
    expect(text).toContain("88,000 IQD");
    const link = waLink("+964 750 123 4567", text);
    expect(link.startsWith("https://wa.me/9647501234567?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1]!)).toBe(text);
    expect(text).not.toMatch(/Discount|Subtotal/);
  });

  const discounted = {
    storeName: "Hawler Bazaar",
    orderNumber: 1002,
    items: [{ name: "Kurdish dress", quantity: 1, lineTotal: 85000 }],
    subtotal: 85000,
    deliveryFee: 3000,
    total: 79500,
    discountCode: "EID10",
    discountAmount: 8500,
    customerName: "Shilan",
    cityName: "Erbil",
    address: "Near the Bazaar Mosque",
    paymentLabel: "Cash on delivery",
  };

  it("adds the subtotal and a discount line with the code and amount, before delivery and total", () => {
    const lines = orderSummaryText(discounted, "en").split("\n");
    const i = lines.indexOf("Discount (EID10): -8,500 IQD");
    expect(i).toBeGreaterThan(0);
    expect(lines[i - 1]).toBe("Subtotal: 85,000 IQD");
    expect(lines[i + 1]).toBe("Delivery: 3,000 IQD");
    expect(lines).toContain("Total: 79,500 IQD");
  });

  it("discount line in Sorani and Arabic", () => {
    expect(orderSummaryText(discounted, "ku")).toMatch(/^داشکاندن \(EID10\): -8,500 /m);
    expect(orderSummaryText(discounted, "ar")).toMatch(/^خصم \(EID10\): -8,500 /m);
  });

  it("a free-delivery code says so instead of an amount", () => {
    const text = orderSummaryText({ ...discounted, discountCode: "FREESHIP", discountAmount: 0, deliveryFee: 0, total: 85000 }, "en");
    expect(text).toContain("Discount (FREESHIP): free delivery");
    expect(text).not.toContain("Subtotal");
  });
});

describe("i18n", () => {
  it("falls back across locales", () => {
    expect(pickText({ en: "Honey" }, "ku")).toBe("Honey");
    expect(pickText({ ku: "هەنگوین", en: "Honey" }, "kmr")).toBe("هەنگوین");
    expect(pickText({ ar: "عسل", en: "Honey" }, "ar")).toBe("عسل");
  });

  it("ku, ar and en message files have identical keys", () => {
    const keys = (o: object, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    const k = keys(ku).sort();
    expect(keys(ar).sort()).toEqual(k);
    expect(keys(en).sort()).toEqual(k);
  });
});

describe("validation", () => {
  it("normalises store input", () => {
    const s = storeSchema.parse({ name: "Hawler Bazaar", slug: "Hawler-Bazaar", phone: "0750 123 4567", instagram: "@hawler.bazaar" });
    expect(s.slug).toBe("hawler-bazaar");
    expect(s.phone).toBe("9647501234567");
    expect(s.instagram).toBe("hawler.bazaar");
  });
  it("requires a product name and integer IQD prices", () => {
    expect(productSchema.safeParse({ name: {}, price: 1000 }).success).toBe(false);
    expect(productSchema.safeParse({ name: { ku: "x" }, price: 10.5 }).success).toBe(false);
    expect(productSchema.safeParse({ name: { ku: "x" }, price: 1000, compareAtPrice: 900 }).success).toBe(false);
    expect(productSchema.safeParse({ name: { ku: "x" }, price: 1000, imageUrls: ["javascript:alert(1)"] }).success).toBe(false);
    expect(productSchema.parse({ name: { ku: "x" }, price: "85000" }).price).toBe(85000);
  });
  it("validates checkout", () => {
    const ok = checkoutSchema.safeParse({
      items: [{ productId: "6f1c1b6e-1d1a-4c55-8e0a-9b1f2f3c4d5e", quantity: 2 }],
      customerName: "Shilan",
      phone: "0770 111 2233",
      cityKey: "erbil",
      address: "Shawes, near the mosque",
      paymentMethod: "cod",
    });
    expect(ok.success).toBe(true);
    expect(checkoutSchema.safeParse({ items: [], customerName: "x" }).success).toBe(false);
  });
  it("order transitions", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("pending", "delivered")).toBe(false);
    expect(canTransition("delivered", "cancelled")).toBe(false);
  });
});

describe("image validation", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
  const svg = new TextEncoder().encode("<svg onload=alert(1)>");
  it("sniffs by magic bytes and enforces size", () => {
    expect(sniffImage(jpeg)?.mime).toBe("image/jpeg");
    expect(sniffImage(png)?.ext).toBe("png");
    expect(sniffImage(svg)).toBeNull();
    expect(() => validateImage(svg, 5)).toThrow();
    expect(() => validateImage(new Uint8Array(6 * 1024 * 1024).fill(0xff), 5)).toThrow();
  });
});

describe("AI hook", () => {
  it("parses model JSON into drafts and drops bad photo indexes", () => {
    const d = parseDrafts('```json\n{"products":[{"name":{"en":"Honey"},"price":25000,"photoIndexes":[0,7]}]}\n```', 2);
    expect(d[0]).toMatchObject({ price: 25000, photoIndexes: [0] });
    expect(() => parseDrafts("not json", 1)).toThrow();
  });
  it("mock provider reads Kurdish prices", async () => {
    const d = await new MockVision().createProductsFromPhotos({
      photos: [{ mime: "image/jpeg", base64: "" }],
      message: "کراس 85 هەزار",
    });
    expect(d[0]!.price).toBe(85000);
  });
});
