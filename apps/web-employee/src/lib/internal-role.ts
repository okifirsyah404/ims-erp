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
