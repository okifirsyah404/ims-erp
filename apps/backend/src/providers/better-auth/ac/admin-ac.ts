/**
 * Global (application) role definitions for Better Auth's `admin()` plugin.
 *
 * Architecture decision (ADR-0006, amended by ADR-0018):
 * - Global roles live on the Better Auth user row (`user.role`) and are managed
 *   through the admin() plugin endpoints only.
 * - `user.role` holds one or more roles as a comma-joined string
 *   (`"admin,investor"`). Read it with {@link hasAppRole}, never `===`.
 * - admin() is for account/session administration and for portal identities
 *   (`investor`, `customer`). It never grants organization or ERP permissions;
 *   those stay in `organization-ac.ts`.
 */
import { createAccessControl } from 'better-auth/plugins/access';
import {
	adminAc,
	defaultStatements,
	userAc,
} from 'better-auth/plugins/admin/access';
import { appRoleNames, hasRole } from '@ims-erp/common';

export const GLOBAL_ADMIN_ROLE = 'admin' as const;
export const GLOBAL_USER_ROLE = 'user' as const;

export const globalRoles = [GLOBAL_ADMIN_ROLE, GLOBAL_USER_ROLE, ...appRoleNames] as const;

export type GlobalRole = (typeof globalRoles)[number];

/**
 * Access control for admin(). Investor and customer are declared with no admin
 * statements, so they cannot call any admin() endpoint. Their portal rights are
 * data-only (`appRoleGrants`) and are checked by the portal modules, not here.
 */
export const adminAccessControl = createAccessControl(defaultStatements);

export const adminPluginRoles = {
	admin: adminAccessControl.newRole({ ...adminAc.statements }),
	user: adminAccessControl.newRole({ ...userAc.statements }),
	investor: adminAccessControl.newRole({}),
	customer: adminAccessControl.newRole({}),
} as const;

/**
 * True when the stored `user.role` holds the given global role.
 *
 * @param role - Raw `user.role` value (comma-joined)
 * @param name - Role to look for
 */
export function hasAppRole(
	role: string | null | undefined,
	name: GlobalRole,
): boolean {
	return hasRole(role, name);
}
