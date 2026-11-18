import type { CheckoutPaymentMethod, DeliveryMethod } from "@ims-erp/api-client";

/**
 * Checkout options (03.03). Fees mirror the approved frame and are SAMPLE values until
 * the ERP publishes shipping/installation pricing. Totals are always recomputed on the
 * server from these rules and catalog prices — never trusted from the browser.
 */

export const TAX_RATE = 0.11;
export const INSTALLATION_FEE = 6_500_000;

export const deliveryOptions: { value: DeliveryMethod; label: string; eta: string; fee: number; icon: "truck" | "zap" | "warehouse" }[] = [
  { value: "standard", label: "Standard trucking", eta: "3–5 working days", fee: 850_000, icon: "truck" },
  { value: "express", label: "Express", eta: "1–2 working days", fee: 1_900_000, icon: "zap" },
  { value: "pickup", label: "Warehouse pickup", eta: "Bekasi · same day", fee: 0, icon: "warehouse" },
];

export const paymentOptions: { value: CheckoutPaymentMethod; label: string; description: string; icon: "landmark" | "qr-code" | "credit-card" | "file-clock" }[] = [
  { value: "va-bca", label: "BCA Virtual Account", description: "Instant verification", icon: "landmark" },
  { value: "va-mandiri", label: "Mandiri Virtual Account", description: "Instant verification", icon: "landmark" },
  { value: "qris", label: "QRIS", description: "GoPay, OVO, DANA, ShopeePay & bank apps", icon: "qr-code" },
  { value: "card", label: "Credit / debit card", description: "Visa, Mastercard, JCB", icon: "credit-card" },
  { value: "invoice", label: "Invoice · NET 14 (business accounts)", description: "Subject to credit approval", icon: "file-clock" },
];

/** Cart + the six checkout wizard steps (03.03): details → address → delivery → payment → review → payment status. */
export const checkoutSteps = ["Cart", "Details", "Address", "Delivery", "Payment", "Review", "Payment status"] as const;

export type CheckoutTotals = {
  subtotal: number;
  discount: number;
  shipping: number;
  installation: number;
  tax: number;
  total: number;
};

/** Shared by the browser summary and the server action, so both always agree. */
export function computeTotals(input: { subtotal: number; discount?: number; delivery: DeliveryMethod; installation: boolean }): CheckoutTotals {
  const discount = Math.min(input.discount ?? 0, input.subtotal);
  const shipping = deliveryOptions.find((d) => d.value === input.delivery)?.fee ?? 0;
  const installation = input.installation ? INSTALLATION_FEE : 0;
  const taxable = input.subtotal - discount + shipping + installation;
  const tax = Math.round(taxable * TAX_RATE);
  return { subtotal: input.subtotal, discount, shipping, installation, tax, total: taxable + tax };
}
