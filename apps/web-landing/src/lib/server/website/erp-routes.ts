import { type WebsiteRoutes } from "@/api/website";
import { ERP_RFQ_PATH } from "astro:env/server";
import { websiteRoutes } from "./routes";

/**
 * ERP endpoints used by the public website, relative to ERP_API_BASE_URL (see `routes.ts`).
 * `ERP_RFQ_PATH` is optional now: when set it overrides the RFQ path (kept for
 * deployments that still define it).
 */
export const erpRoutes: WebsiteRoutes = {
  ...websiteRoutes,
  ...(ERP_RFQ_PATH ? { submitRfq: ERP_RFQ_PATH } : {}),
};
