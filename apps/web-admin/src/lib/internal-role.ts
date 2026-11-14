/**
 * Roles that do not grant access to web-admin (ADR-0017 §8). A membership
 * holding only these is not offered in the organization switcher.
 */
const NON_INTERNAL_ROLES: readonly string[] = ['investor', 'customer'];

/** True when a comma-joined `member.role` holds at least one internal role. */
export function hasInternalRole(role: string): boolean {
	return role
		.split(',')
		.map((r) => r.trim())
		.some((r) => r !== '' && !NON_INTERNAL_ROLES.includes(r));
}
