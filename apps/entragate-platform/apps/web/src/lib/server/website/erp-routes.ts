import type { WebsiteRoutes } from "@ims-erp/api-client";
import { ERP_RFQ_PATH } from "astro:env/server";

/**
 * ERP endpoints used by the public website, relative to ERP_API_BASE_URL. Empty until the
 * ERP team publishes its contract — unset operations fail with "not connected yet"
 * instead of guessing. `ERP_RFQ_PATH` is still honoured for the RFQ endpoint.
 *
 * Example:
 *   sendContactMessage: "/public/contact",
 *   trackOrder: "/public/orders/track",
 */
export const erpRoutes: WebsiteRoutes = {
  ...(ERP_RFQ_PATH ? { submitRfq: ERP_RFQ_PATH } : {}),
};
