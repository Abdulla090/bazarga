/** Seller order export: pure CSV building (Excel-safe, formula-injection safe). */
export type ExportOrder = {
  number: number;
  createdAt: Date;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  customerName: string;
  customerPhone: string;
  cityName: string;
  areaName: string | null;
  address: string;
  landmark: string | null;
  notes: string | null;
  subtotal: number;
  discountAmount: number;
  discountCode: string | null;
  deliveryFee: number;
  total: number;
  courierName: string | null;
  trackingNumber: string | null;
  items: { name: string; variantTitle: string | null; quantity: number }[];
};

export const ORDER_CSV_HEADERS = [
  "order", "date", "status", "payment_method", "payment_status", "customer", "phone", "city", "area",
  "address", "landmark", "notes", "items", "subtotal", "discount", "discount_code", "delivery_fee", "total",
  "courier", "tracking",
] as const;

/** Cells starting with = + - @ tab or CR would run as formulas in Excel/Sheets: prefix an apostrophe. */
export function csvCell(value: string | number | null | undefined): string {
  let s = value == null ? "" : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function itemsSummary(items: ExportOrder["items"]): string {
  return items.map((i) => `${i.quantity} x ${i.name}${i.variantTitle ? ` (${i.variantTitle})` : ""}`).join("; ");
}

/** Date in Baghdad time (UTC+3, no DST) as YYYY-MM-DD HH:mm. */
export function baghdadStamp(d: Date): string {
  return new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 16).replace("T", " ");
}

/** UTF-8 BOM first so Excel reads Kurdish/Arabic text correctly. CRLF line ends. */
export function ordersToCsv(rows: ExportOrder[]): string {
  const lines = [ORDER_CSV_HEADERS.join(",")];
  for (const o of rows) {
    lines.push(
      [
        o.number, baghdadStamp(o.createdAt), o.status, o.paymentMethod, o.paymentStatus, o.customerName, o.customerPhone,
        o.cityName, o.areaName, o.address, o.landmark, o.notes, itemsSummary(o.items), o.subtotal, o.discountAmount,
        o.discountCode, o.deliveryFee, o.total, o.courierName, o.trackingNumber,
      ].map(csvCell).join(","),
    );
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
