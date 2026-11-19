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
 * - not built in the ERP yet: onboarding, notifications, device lookup/registration,
 *   service booking, profile, documents, personal/company/settings updates, sites
 *   and wishlist.
 *
 * Ordering itself happens on the website (catalog + checkout, user decision 2026-11-19);
 * the order arrives here as a quotation "in review" (ERP-0070).
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

  // Quotations, orders, invoices and payment (ERP-0070)
  listQuotations: "/portal/v1/quotations",
  getQuotation: "/portal/v1/quotations/:id",
  acceptQuotation: "/portal/v1/quotations/:id/accept",
  requestQuotationRevision: "/portal/v1/quotations/:id/revision",
  listOrders: "/portal/v1/orders",
  getOrder: "/portal/v1/orders/:id",
  listInvoices: "/portal/v1/invoices",
  getInvoice: "/portal/v1/invoices/:id",
  listPaymentMethods: "/portal/v1/payment-methods",
  payInvoice: "/portal/v1/invoices/:id/pay",

  // Website RFQs: signed-in RFQs and guest RFQs claimed with an emailed code (ERP-0072)
  listRfqs: "/portal/v1/rfqs",
  requestRfqClaim: "/portal/v1/rfqs/claim",
  confirmRfqClaim: "/portal/v1/rfqs/claim/confirm",

  // Sign-in-free order lookup (ERP-0073): minimal status, no customer, prices or addresses
  lookupPublicOrder: "/public/v1/orders/:id/status",
};
