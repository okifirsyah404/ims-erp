/**
 * Web-admin login gate (ADR-0017 §8, amended by ADR-0018).
 *
 * A session is allowed into web-admin only when the account is active
 * (ERP-0107: not a pending invitation, not deactivated, not soft-deleted) and
 * the user is an application administrator, or holds at least one
 * organization membership with an internal organization role. Portal-only
 * users (`investor`/`customer` app roles, or no membership at all) are
 * rejected.
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

/** Error codes the login gate returns; also the web `/login?error=` values. */
export const ACCOUNT_NOT_ACTIVE = 'ACCOUNT_NOT_ACTIVE';
export const WEB_ADMIN_ACCESS_DENIED = 'WEB_ADMIN_ACCESS_DENIED';

export type TWebAdminDenial = typeof ACCOUNT_NOT_ACTIVE | typeof WEB_ADMIN_ACCESS_DENIED;

/**
 * Whether an `auth.users` row may sign in at all (ERP-0107 hardening).
 *
 * @remarks
 * `pending` = pre-created by an invitation that was not claimed yet (the
 * claim sets `active` before it opens the first session); `deactivated` =
 * switched off by an administrator; a soft-deleted row never signs in. A
 * `null` status is treated as `active` (rows written before the column).
 */
export function isAccountActive(input: {
	status: string | null | undefined;
	deletedAt: Date | string | null | undefined;
}): boolean {
	return (input.status ?? 'active') === 'active' && !input.deletedAt;
}

/**
 * Full web-admin session decision: account state first, then the role gate.
 *
 * @returns `null` when allowed, otherwise the denial code
 */
export function webAdminDenial(input: {
	userRole: string | null | undefined;
	memberRoles: readonly (string | null | undefined)[];
	status: string | null | undefined;
	deletedAt: Date | string | null | undefined;
}): TWebAdminDenial | null {
	if (!isAccountActive(input)) return ACCOUNT_NOT_ACTIVE;
	return isWebAdminAllowed(input) ? null : WEB_ADMIN_ACCESS_DENIED;
}
