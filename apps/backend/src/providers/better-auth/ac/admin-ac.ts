/**
 * Global (account administration) role definitions for Better Auth's
 * `admin()` plugin.
 *
 * Architecture decision (ADR-0006):
 * - The only global roles are `admin` and `user`, stored on the Better Auth
 *   user row and managed exclusively through the admin() plugin endpoints.
 * - admin() is used for account/session administration ONLY. It must never
 *   grant ERP permissions, organization access, or tenant bypasses.
 * - We intentionally keep the installed version's default admin/user
 *   permission model (including default impersonation rules) - no
 *   additional privileges are granted here.
 *
 * ERP authorization lives entirely in `organization-ac.ts` (organization
 * membership roles via the organization() plugin).
 */

/** Global role stored on the Better Auth user (`user.role` column). */
export const GLOBAL_ADMIN_ROLE = 'admin' as const;
export const GLOBAL_USER_ROLE = 'user' as const;

export const globalRoles = [GLOBAL_ADMIN_ROLE, GLOBAL_USER_ROLE] as const;

export type GlobalRole = (typeof globalRoles)[number];

/**
 * Marker assertion kept for documentation value: admin() with default
 * options recognizes exactly these global roles. If Better Auth's defaults
 * ever change, update this constant and re-verify the admin() plugin
 * behavior against the installed version.
 */
export const adminPluginDefaultRoles: readonly string[] = ['admin', 'user'];
