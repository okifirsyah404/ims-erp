/**
 * Shared "application administrator only" gate.
 *
 * @remarks
 * Extracted from three near-identical private copies (`user`,
 * `organization-bootstrap`, and `user-management` controllers). It reads the
 * **platform** role off the guard-resolved session, never client input, and is
 * deliberately membership-independent: an application admin who belongs to no
 * organization must still be able to bootstrap the first one and to manage
 * global (`organization_id IS NULL`) records.
 *
 * The parameter is structural rather than a full {@link ErpContext} on
 * purpose: this is used as the `policy` hook of BOTH `erpGuard` (which yields
 * `organizationId`/`member`) and `sessionGuard` (which yields `session` only).
 * Requiring `ErpContext` would make it unusable on the session-only guard —
 * exactly the combination warehouse routes need.
 *
 * Uses {@link GLOBAL_ADMIN_ROLE} rather than the string literal so the single
 * documented source of truth (ADR-0006) stays authoritative.
 *
 * @param context - The guard-resolved context carrying at least the session
 * @throws {NotGlobalAdminError} 403 when the caller is not a platform admin
 */
import { NotGlobalAdminError } from '@http/errors';
import { GLOBAL_ADMIN_ROLE } from '@providers/better-auth/ac/admin-ac';
import type { SessionPayload } from './elysia-auth';

export type TRequireGlobalAdminContext = {
	erp: { session: SessionPayload };
};

/**
 * Throws unless the caller holds the platform administrator role.
 *
 * @param context - The guard-resolved context carrying at least the session
 */
export function requireGlobalAdmin({
	erp,
}: TRequireGlobalAdminContext): void {
	if (erp.session.user.role !== GLOBAL_ADMIN_ROLE) {
		throw new NotGlobalAdminError(
			'Application administrator role required',
			'user.globalAdminRequired',
		);
	}
}

/**
 * Predicate form for call sites that need a boolean rather than an exception.
 *
 * @param context - The guard-resolved context carrying at least the session
 * @returns Whether the caller is a platform administrator
 */
export function isGlobalAdmin({
	erp,
}: TRequireGlobalAdminContext): boolean {
	return erp.session.user.role === GLOBAL_ADMIN_ROLE;
}
