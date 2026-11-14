import type { BetterAuthOptions } from 'better-auth';
import { APIError } from 'better-auth/api';
import { drizzleDB } from '../../../../drizzle/db';
import { members, users } from '../../../../drizzle/schemas/auth.schema';
import { asc, eq } from 'drizzle-orm';
import { hasInternalOrgRole, isWebAdminAllowed } from '../ac/login-gate';

type SessionCreateBefore = NonNullable<
	NonNullable<
		NonNullable<BetterAuthOptions['databaseHooks']>['session']
	>['create']
>['before'];

/**
 * Loads every membership of a user and applies the web-admin login gate
 * (ADR-0017 §8, amended by ADR-0018).
 *
 * @remarks
 * Shared by the login hook below and by `sessionGuard`, so sessions created
 * before the gate existed are rejected on their next request too.
 *
 * @param userId - The user whose session is being created or checked
 * @returns The membership rows (organization id and role) of the user
 */
export async function loadMembershipsForGate(userId: string) {
	return drizzleDB
		.select({
			organizationId: members.organizationId,
			role: members.role,
			createdAt: members.createdAt,
		})
		.from(members)
		.where(eq(members.userId, userId))
		.orderBy(asc(members.createdAt));
}

/**
 * Rejects a session for a user who is neither an application admin nor a
 * holder of an internal organization role.
 *
 * @param userId - The user to check
 * @throws {APIError} FORBIDDEN when the gate is closed
 */
export async function assertWebAdminAllowed(userId: string): Promise<void> {
	const [user] = await drizzleDB
		.select({ role: users.role })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	const memberships = await loadMembershipsForGate(userId);
	if (
		!isWebAdminAllowed({
			userRole: user?.role,
			memberRoles: memberships.map((m) => m.role),
		})
	) {
		throw new APIError('FORBIDDEN', {
			message: 'Web-admin access requires an internal organization role',
		});
	}
}

/**
 * Boolean form of {@link assertWebAdminAllowed} for the per-request guard.
 *
 * @param userId - The authenticated user
 * @returns Whether the user still passes the web-admin login gate
 */
export async function isWebAdminSessionAllowed(userId: string): Promise<boolean> {
	return assertWebAdminAllowed(userId).then(
		() => true,
		(error: unknown) => {
			if (error instanceof APIError) return false;
			throw error;
		},
	);
}

/**
 * Login gate and default organization on session creation.
 *
 * @remarks
 * Runs in `session.create.before` (ADR-0017 §8-9):
 * - Rejects the session when the gate is closed (throws FORBIDDEN).
 * - When no organization is active, selects the first membership with an
 *   internal organization role. Memberships without one are never chosen.
 *
 * Returning `{ data }` overrides the session row before it is persisted.
 * Existing sessions keep their stored value.
 */
export const sessionAutoActivateOrganizationHook: SessionCreateBefore = async (
	session,
) => {
	await assertWebAdminAllowed(session.userId);
	if (session.activeOrganizationId) return;
	const memberships = await loadMembershipsForGate(session.userId);
	const internal = memberships.find((m) => hasInternalOrgRole(m.role));
	if (!internal) return;
	return {
		data: { ...session, activeOrganizationId: internal.organizationId },
	};
};
