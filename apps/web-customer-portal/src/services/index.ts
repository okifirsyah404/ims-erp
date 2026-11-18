import { type AuthTokens } from "@/api/portal";
import { portal } from "./portal";

/**
 * Typed ERP services grouped by domain. All calls run server-side (Astro pages, actions,
 * middleware) through `portal`, which is either the external NestJS ERP adapter or the
 * development demo source (see ./portal/index.ts). Endpoint paths: ./portal/erp-routes.ts.
 */
type T = AuthTokens;

export const authService = {
  login: (input: Parameters<typeof portal.login>[0]) => portal.login(input),
  register: (input: Parameters<typeof portal.register>[0]) => portal.register(input),
  verifyEmail: (input: Parameters<typeof portal.verifyEmail>[0]) => portal.verifyEmail(input),
  resendVerification: (input: Parameters<typeof portal.resendVerification>[0]) => portal.resendVerification(input),
  requestPasswordReset: (input: Parameters<typeof portal.requestPasswordReset>[0]) => portal.requestPasswordReset(input),
  resetPassword: (input: Parameters<typeof portal.resetPassword>[0]) => portal.resetPassword(input),
  refresh: (refreshToken: string) => portal.refreshSession(refreshToken),
  logout: (t: T) => portal.logout(t),
};

export const customerService = {
  home: (t: T) => portal.getHome(t),
  badges: (t: T) => portal.getBadges(t),
  profile: (t: T) => portal.getProfile(t),
  account: (t: T) => portal.getAccount(t),
  notifications: (t: T) => portal.listNotifications(t),
  documents: (t: T, folder?: Parameters<typeof portal.listDocuments>[1]) => portal.listDocuments(t, folder),
  wishlist: (t: T) => portal.listWishlist(t),
};

export const ordersService = {
  list: (t: T) => portal.listOrders(t),
  get: (t: T, id: string) => portal.getOrder(t, id),
  lookupPublic: (orderNumber: string) => portal.lookupPublicOrder(orderNumber),
};

export const projectsService = {
  list: (t: T) => portal.listProjects(t),
  get: (t: T, id: string) => portal.getProject(t, id),
};

export const quotationsService = {
  list: (t: T) => portal.listQuotations(t),
  get: (t: T, id: string) => portal.getQuotation(t, id),
};

export const invoicesService = {
  list: (t: T) => portal.listInvoices(t),
  get: (t: T, id: string) => portal.getInvoice(t, id),
};

export const paymentsService = {
  methods: (t: T) => portal.listPaymentMethods(t),
};

export const supportService = {
  list: (t: T) => portal.listTickets(t),
  get: (t: T, id: string) => portal.getTicket(t, id),
  bookingOptions: (t: T) => portal.getBookingOptions(t),
};

export const warrantyService = {
  products: (t: T) => portal.listProducts(t),
  get: (t: T, productId: string) => portal.getWarranty(t, productId),
};
