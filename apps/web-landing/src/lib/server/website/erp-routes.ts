import { type WebsiteRoutes } from "@/api/website";
import { ERP_RFQ_PATH } from "astro:env/server";

/**
 * ERP endpoints used by the public website, relative to ERP_API_BASE_URL. Unset operations
 * fail with "not connected yet" instead of guessing. `ERP_RFQ_PATH` is still honoured for
 * the RFQ endpoint.
 *
 * Checkout (ERP-0070) runs as the signed-in customer with the session from the portal
 * hand-off: the order becomes a draft quotation that sales reviews, so `placeOrder`
 * answers `pending_approval` and nothing is charged at checkout. The account cart
 * (`getCart`/`syncCart`) is not built in the ERP; the cart stays on the device.
 *
 * Website forms (ERP-0072) become CRM leads through `/public/v1/*` with the website key;
 * a signed-in customer's RFQ also carries their portal session and joins their account.
 * Promo codes are not built in the ERP (owner decision 2026-11-20): `applyPromo` stays
 * unmapped and the checkout hides the promo field.
 */
export const erpRoutes: WebsiteRoutes = {
  submitRfq: ERP_RFQ_PATH || "/public/v1/rfq",
  sendContactMessage: "/public/v1/contact",
  requestDemo: "/public/v1/demo",
  // Order tracking (ERP-0073): the full status when the email or phone matches the order.
  trackOrder: "/public/v1/orders/track",
  quoteOrder: "/portal/v1/checkout/quote",
  placeOrder: "/portal/v1/checkout/orders",
  getPaymentStatus: "/portal/v1/checkout/orders/:orderNumber",
};
