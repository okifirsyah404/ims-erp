import type { WebsiteRoutes } from "@/api/website";

/**
 * ERP website-form endpoints, relative to ERP_API_BASE_URL (backend:
 * `apps/backend/src/app/project/controllers/public-website.controller.ts`). All use the
 * website API key. Operations not listed here (promo, cart, quote, order, payment status,
 * tracking) have no ERP endpoint yet and fail with `WebsiteNotConfiguredError`.
 */
export const websiteRoutes: WebsiteRoutes = {
  submitRfq: "/projects/public/v1/rfq",
  sendContactMessage: "/projects/public/v1/contact",
  requestDemo: "/projects/public/v1/demo",
};
