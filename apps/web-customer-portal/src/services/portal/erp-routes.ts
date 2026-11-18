import { type PortalRoutes } from "@/api/portal";

/**
 * ERP endpoint map, relative to ERP_API_BASE_URL (the ERP backend root). Published by
 * the ERP in `docs/architecture/modules/customer-portal.md` (ERP-0022 stage 1,
 * 2026-11-14; readable reference: the backend's OpenAPI document at `/docs`).
 * Set ERP_RESPONSE_ENVELOPE=data:
 * the ERP answers `{ requestId, status, message, timestamp, data }`.
 *
 * `:id` placeholders are URL-encoded at call time; absolute URLs, `//` and `..` are
 * rejected at startup. Operations left out raise PortalNotConfiguredError, which pages
 * show as an error and actions as "This feature isn't connected yet":
 * - `refreshSession` on purpose: ERP sessions are Better Auth's 7-day sessions and
 *   there is no refresh token; the portal signs the user out when they expire.
 * - stage 2 (not built in the ERP yet): onboarding, notifications, orders, quotations,
 *   invoices and payments, device lookup/registration, service booking, profile,
 *   documents, personal/company/settings updates, sites, wishlist, public order
 *   lookup and RFQs.
 */
export const erpRoutes: PortalRoutes = {
  // Account and session
  login: "/portal/v1/auth/login",
  register: "/portal/v1/auth/register",
  verifyEmail: "/portal/v1/auth/verify-email",
  resendVerification: "/portal/v1/auth/verify-email/resend",
  requestPasswordReset: "/portal/v1/auth/password-reset",
  resetPassword: "/portal/v1/auth/password-reset/confirm",
  logout: "/portal/v1/auth/logout",
  changePassword: "/portal/v1/account/password",
  getAccount: "/portal/v1/account",
  inviteMember: "/portal/v1/account/members",
  removeMember: "/portal/v1/account/members/:id",

  // Home and navigation
  getHome: "/portal/v1/home",
  getBadges: "/portal/v1/badges",

  // Projects (M07)
  listProjects: "/portal/v1/projects",
  getProject: "/portal/v1/projects/:id",

  // Support tickets
  listTickets: "/portal/v1/tickets",
  getTicket: "/portal/v1/tickets/:id",
  createTicket: "/portal/v1/tickets",
  postTicketMessage: "/portal/v1/tickets/:id/messages",

  // Devices and warranty
  listProducts: "/portal/v1/products",
  getWarranty: "/portal/v1/products/:id/warranty",
};
