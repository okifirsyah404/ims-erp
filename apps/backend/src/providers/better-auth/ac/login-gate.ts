/**
 * Web-admin login gate (ADR-0017 §8, amended by ADR-0018).
 *
 * A session is allowed into web-admin only when the user is an application
 * administrator, or holds at least one organization membership with an
 * internal organization role. Portal-only users (`investor`/`customer` app
 * roles, or no membership at all) are rejected.
 *
 * The internal role set is the organization catalog (`erpRoleNames`). The
 * investor and customer roles are no longer organization roles, so they can
 * never count as internal.
 */
import { erpRoleNames } from '@ims-erp/common';
import { GLOBAL_ADMIN_ROLE, hasAppRole } from './admin-ac';

const INTERNAL_ROLES: ReadonlySet<string> = new Set(erpRoleNames);

/**
 * True when a comma-joined organization `member.role` holds an internal role.
 *
 * @param memberRole - Raw `member.role` value, may hold several roles
 */
export function hasInternalOrgRole(memberRole: string | null | undefined): boolean {
	if (!memberRole) return false;
	return memberRole
		.split(',')
		.map((r) => r.trim())
		.some((r) => INTERNAL_ROLES.has(r));
}

/**
 * Decides whether a user may hold a web-admin session.
 *
 * @param input.userRole - Raw `user.role` (app roles, comma-joined)
 * @param input.memberRoles - Every `member.role` value of the user
 * @returns true when the session is allowed
 */
export function isWebAdminAllowed(input: {
	userRole: string | null | undefined;
	memberRoles: readonly (string | null | undefined)[];
}): boolean {
	if (hasAppRole(input.userRole, GLOBAL_ADMIN_ROLE)) return true;
	return input.memberRoles.some((role) => hasInternalOrgRole(role));
}
