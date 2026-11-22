import type { PortalUser } from "@/api/portal";

/**
 * The only global (Better Auth) role this portal admits (ADR-0027, amended 2026-11-21). The ERP
 * cannot tell which client sent a request, so it returns the login's roles and the portal
 * decides: staff, investors and any other role never get a portal session.
 */
export const PORTAL_ROLE = "customer";

/** Whether a signed-in login may hold a portal session. A user without `roles` (older session) may not. */
export function isPortalCustomer(user: Pick<PortalUser, "roles"> | undefined): boolean {
  return Array.isArray(user?.roles) && user.roles.includes(PORTAL_ROLE);
}
