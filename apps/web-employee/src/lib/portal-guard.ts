import type { QueryClient } from '@tanstack/react-query';
import { hasRole } from '@ims-erp/common';
import { signOut } from '@/lib/auth-client';
import type { TPortalAccess } from '@/lib/portal-api';
import { portalAccessQueryOptions } from '@/lib/portal-api';

/** Global app roles the employee portal never serves (ADR-0018 names). */
export const EXCLUDED_APP_ROLES = ['admin', 'investor', 'customer'] as const;

type PortalSession = { user: { role?: string | null } };

/** Why the portal refused this session. */
export type TPortalDenial =
	| { kind: 'excluded-role' }
	| { kind: 'no-employee-record' }
	| { kind: 'probe-failed'; message: string };

export type TPortalEntry =
	| { kind: 'ok'; access: TPortalAccess }
	| { kind: 'denied'; reason: TPortalDenial };

/**
 * Decides whether a session may use the portal, and revokes it when not.
 *
 * @remarks
 * Mirrors the backend `employeePortal` guard, plus one extra rule the guard
 * cannot enforce on its own: an app role in {@link EXCLUDED_APP_ROLES} is
 * refused even when the user also holds an employee record (an application
 * admin belongs in web-admin, an investor or customer in their own portal).
 *
 * The access probe is the only portal endpoint that answers without an
 * organization, so it is also the only one that can tell "no employee record
 * anywhere" apart from "no employee record here".
 *
 * A failed probe fails closed: the session is revoked rather than leaving a
 * cookie the app cannot use.
 */
export async function canEnterPortal(
	session: PortalSession,
	queryClient: QueryClient,
): Promise<TPortalEntry> {
	if (EXCLUDED_APP_ROLES.some((role) => hasRole(session.user.role, role))) {
		await revokeSession();
		return { kind: 'denied', reason: { kind: 'excluded-role' } };
	}
	try {
		const access = await queryClient.ensureQueryData(portalAccessQueryOptions);
		if (access.organizations.length === 0) {
			await revokeSession();
			return { kind: 'denied', reason: { kind: 'no-employee-record' } };
		}
		return { kind: 'ok', access };
	} catch (error) {
		await revokeSession();
		return {
			kind: 'denied',
			reason: {
				kind: 'probe-failed',
				message: error instanceof Error ? error.message : 'Portal access check failed',
			},
		};
	}
}

/** Drops the portal session; a failed call is already a revoked session. */
async function revokeSession(): Promise<void> {
	try {
		await signOut();
	} catch {
		// The cookie is either already gone or unreachable; the login page retries.
	}
	queryClientRemovePortalCache();
}

/** Portal cache is useless after a revoke; never let it leak to the next user. */
function queryClientRemovePortalCache(): void {
	// Imported lazily to avoid a cycle with `query-client` -> `portal-guard`.
	void import('@/lib/query-client').then(({ queryClient }) => {
		queryClient.removeQueries({ queryKey: ['employee-portal'] });
	});
}
