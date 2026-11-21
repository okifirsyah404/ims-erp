import { type PortalRoutes } from "@/api/portal";

/**
 * ERP endpoint map, relative to ERP_API_BASE_URL (the ERP backend root, e.g.
 * `http://localhost:3001`; the backend has no global prefix). Published by the ERP in
 * `docs/architecture/modules/customer-portal.md` and implemented by
 * `apps/backend/src/app/customer/controllers/portal.controller.ts` (ADR-0024 Q28 moved
 * the prefix from `/portal/v1` to `/customers/portal/v1`; the old paths are gone).
 * Success bodies are the ERP envelope `{ requestId, status, message, timestamp, data }`
 * (see ./envelope.ts). Sign-in and sign-up verification answer `Set-Cookie` with the ERP's
 * session cookie; authenticated routes take it back as the `Cookie` header (ERP-0094,
 * ADR-0027). It lives only in the portal's server-side session, never in a browser.
 * Every call carries the visitor's language as `Accept-Language` (the portal's own cookie;
 * the ERP stores no portal language).
 *
 * `:id` placeholders are URL-encoded at call time (a device id `<uuid>:<line>` keeps its
 * colon); absolute URLs, `//` and `..` are rejected at startup. Operations left out raise
 * PortalNotConfiguredError, which pages show as /coming-soon or an empty section and
 * actions as "This feature isn't connected yet":
 * - `refreshSession` on purpose: ERP sessions are Better Auth's 7-day sessions with no
 *   refresh token; the portal signs the user out when they expire.
 * - no backend route yet (stage 2): `completeOnboarding`, notifications, orders,
 *   quotations (list/detail/accept/revision), invoices and payments (list/detail/pay,
 *   methods), device lookup/registration, service booking, profile summary, documents,
 *   `updatePersonal` / `updateCompany`, sites, wishlist, public order
 *   lookup and RFQs.
 */
const PORTAL = "/customers/portal/v1";

export const erpRoutes: PortalRoutes = {
  // Account and session
  login: `${PORTAL}/auth/login`,
  register: `${PORTAL}/auth/register`,
  verifyEmail: `${PORTAL}/auth/verify-email`,
  resendVerification: `${PORTAL}/auth/verify-email/resend`,
  requestPasswordReset: `${PORTAL}/auth/password-reset`,
  resetPassword: `${PORTAL}/auth/password-reset/confirm`,
  logout: `${PORTAL}/auth/logout`,
  changePassword: `${PORTAL}/account/password`,
  getAccount: `${PORTAL}/account`,
  // Devices and deleting the login (ERP-0106)
  listDevices: `${PORTAL}/account/devices`,
  revokeDevice: `${PORTAL}/account/devices/:id`,
  signOutOtherDevices: `${PORTAL}/account/devices/sign-out-others`,
  closeAccount: `${PORTAL}/account/close`,
  inviteMember: `${PORTAL}/account/members`,
  removeMember: `${PORTAL}/account/members/:id`,

  // Home and navigation
  getHome: `${PORTAL}/home`,
  getBadges: `${PORTAL}/badges`,

  // Projects (M07)
  listProjects: `${PORTAL}/projects`,
  getProject: `${PORTAL}/projects/:id`,

  // Support tickets
  listTickets: `${PORTAL}/tickets`,
  getTicket: `${PORTAL}/tickets/:id`,
  createTicket: `${PORTAL}/tickets`,
  postTicketMessage: `${PORTAL}/tickets/:id/messages`,

  // Devices and warranty
  listProducts: `${PORTAL}/products`,
  getWarranty: `${PORTAL}/products/:id/warranty`,
};
