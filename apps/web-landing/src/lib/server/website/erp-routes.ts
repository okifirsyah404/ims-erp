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
 */
export const erpRoutes: WebsiteRoutes = {
  ...(ERP_RFQ_PATH ? { submitRfq: ERP_RFQ_PATH } : {}),
  quoteOrder: "/portal/v1/checkout/quote",
  placeOrder: "/portal/v1/checkout/orders",
  getPaymentStatus: "/portal/v1/checkout/orders/:orderNumber",
};
