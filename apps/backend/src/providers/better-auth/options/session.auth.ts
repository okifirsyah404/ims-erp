import type { BetterAuthOptions } from 'better-auth';
import { APIError } from 'better-auth/api';
import { drizzleDB } from '../../../../drizzle/db';
import { members, users } from '../../../../drizzle/schemas/auth.schema';
import { customers } from '../../../../drizzle/schemas/customer.schema';
import { and, asc, eq, isNull } from 'drizzle-orm';
import {
	ACCOUNT_NOT_ACTIVE,
	WEB_ADMIN_ACCESS_DENIED,
	hasInternalOrgRole,
	webAdminDenial,
} from '../ac/login-gate';
import { translateForRequest } from '@providers/i18n/translator';
import { PORTAL_SIGNIN_HEADER, PORTAL_SIGNIN_NONCE } from '../portal-signin';

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

/** Translation key per gate denial code (`api` namespace). */
const DENIAL_MESSAGE_KEY = {
	[ACCOUNT_NOT_ACTIVE]: 'auth.accountNotActive',
	[WEB_ADMIN_ACCESS_DENIED]: 'auth.webAdminAccessDenied',
} as const;

/**
 * Rejects a session for an inactive account (pending invitation,
 * deactivated, soft-deleted — ERP-0111) or for a user who is neither an
 * application admin nor a holder of an internal organization role.
 *
 * @remarks
 * The error carries a `code`: Better Auth's OAuth callback turns a coded
 * `APIError` into `?error=<code>` on the error callback URL (otherwise the
 * browser lands on a raw JSON error at the API origin), and the password
 * form receives it as `error.code`.
 *
 * @param userId - The user to check
 * @param headers - Request headers, for the message language
 * @throws {APIError} FORBIDDEN with `ACCOUNT_NOT_ACTIVE` or
 * `WEB_ADMIN_ACCESS_DENIED`
 */
export async function assertWebAdminAllowed(
	userId: string,
	headers?: Headers,
): Promise<void> {
	const [user] = await drizzleDB
		.select({ role: users.role, status: users.status, deletedAt: users.deletedAt })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	const memberships = await loadMembershipsForGate(userId);
	const denial = webAdminDenial({
		userRole: user?.role,
		memberRoles: memberships.map((m) => m.role),
		// A missing row is never a valid account.
		status: user ? user.status : 'missing',
		deletedAt: user?.deletedAt,
	});
	if (denial) {
		throw new APIError('FORBIDDEN', {
			code: denial,
			message: translateForRequest(DENIAL_MESSAGE_KEY[denial], headers),
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
 * Whether this session is the customer portal's own sign-in (ERP-0022,
 * ADR-0022): the request carries the portal module's per-process nonce and the
 * user holds an active portal identity. Such a session is for `/portal/v1`
 * only; it never gets an organization, and `sessionGuard` / `erpGuard` keep
 * refusing it on every web-admin route through the login gate.
 */
/** Headers of the Better Auth endpoint context, when there is a request. */
function requestHeaders(context: unknown): Headers | undefined {
	const request = context as { headers?: Headers; request?: Request } | null | undefined;
	return request?.headers ?? request?.request?.headers;
}

async function isPortalSignIn(userId: string, context: unknown): Promise<boolean> {
	const headers = requestHeaders(context);
	if (headers?.get(PORTAL_SIGNIN_HEADER) !== PORTAL_SIGNIN_NONCE) return false;
	const [identity] = await drizzleDB
		.select({ id: customers.id })
		.from(customers)
		.where(
			and(
				eq(customers.userId, userId),
				eq(customers.portalStatus, 'active'),
				isNull(customers.deletedAt),
			),
		)
		.limit(1);
	return !!identity;
}

/**
 * Login gate and default organization on session creation.
 *
 * @remarks
 * Runs in `session.create.before` (ADR-0017 §8-9; the portal exception is
 * ADR-0022):
 * - Rejects the session when the gate is closed (throws FORBIDDEN).
 * - When no organization is active, selects the first membership with an
 *   internal organization role. Memberships without one are never chosen.
 *
 * Returning `{ data }` overrides the session row before it is persisted.
 * Existing sessions keep their stored value.
 */
export const sessionAutoActivateOrganizationHook: SessionCreateBefore = async (
	session,
	context,
) => {
	// The customer portal's sign-in passes the gate, without an organization.
	if (await isPortalSignIn(session.userId, context)) return;
	await assertWebAdminAllowed(session.userId, requestHeaders(context));
	if (session.activeOrganizationId) return;
	const memberships = await loadMembershipsForGate(session.userId);
	const internal = memberships.find((m) => hasInternalOrgRole(m.role));
	if (!internal) return;
	return {
		data: { ...session, activeOrganizationId: internal.organizationId },
	};
};
