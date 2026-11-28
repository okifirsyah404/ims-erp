import { erpRoleNames, parseRoleList } from '@ims-erp/common';

const INTERNAL_ROLES: ReadonlySet<string> = new Set(erpRoleNames);

/**
 * True when a comma-joined `member.role` holds at least one internal
 * organization role (ADR-0017 §8, amended by ADR-0018). Investor and customer
 * are app roles, not organization roles, so they never count.
 */
export function hasInternalRole(role: string): boolean {
	return parseRoleList(role).some((r) => INTERNAL_ROLES.has(r));
}

/**
 * True when a comma-joined `member.role` includes the organization owner.
 *
 * @remarks
 * The owner-only settings entry (M12-2) shows the company organization
 * profile; `owner` is the only role that owns it (an app admin gets it
 * through the separate app-admin branch).
 */
export function isOwnerRole(role: string): boolean {
	return parseRoleList(role).includes('owner');
}
