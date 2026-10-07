/**
 * Cart/checkout label keys. Lives outside the "use client" CartCheckout module: a server page importing a value
 * from a client module gets a client *reference*, not the array (that broke /s/[slug]/cart at runtime).
 */
export const CART_LABEL_KEYS = ["address", "addressHint", "cart", "checkout", "continue", "deliverTo", "delivery", "emptyCart", "name", "notes", "payment", "phone", "placeOrder", "qty", "subtotal", "total", "unavailableLine", "yourDetails", "area", "chooseArea", "otherArea", "areaPlaceholder", "landmark", "landmarkHint", "addressDetails", "phoneHint", "haveCode", "discountCode", "apply", "removeCode", "discount", "codeApplied", "freeDeliveryUnlocked", "freeDeliveryProgress", "placing", "free"] as const;

/** Store strings translated on the server; `errors` is the errors namespace (storefronts ship no i18n runtime). */
export type CartLabels = Record<(typeof CART_LABEL_KEYS)[number], string> & { cod: string; errors: Record<string, string> };

export const PAYMENT_PANEL_KEYS = ["paid", "fibTitle", "fibScan", "openFib", "payPending", "paymentFailed", "checkStatus", "retryPayment"] as const;
export type PaymentPanelLabels = Record<(typeof PAYMENT_PANEL_KEYS)[number], string>;
