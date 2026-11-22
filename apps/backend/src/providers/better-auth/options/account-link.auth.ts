import type { BetterAuthOptions } from 'better-auth';
import { APIError } from 'better-auth/api';
import { translateForRequest } from '@providers/i18n/translator';
import { ACCOUNT_NOT_ACTIVE, isAccountActive } from '../ac/login-gate';

type AccountCreateBefore = NonNullable<
	NonNullable<
		NonNullable<NonNullable<BetterAuthOptions['databaseHooks']>['account']>['create']
	>['before']
>;

type TAccountOwner = {
	status: string | null;
	deletedAt: Date | string | null;
};

/**
 * Refuses to attach a social login (Google) to an account that is not active
 * (ERP-0109 hardening).
 *
 * @remarks
 * An invitation pre-creates the user with `emailVerified: true` and
 * `status: 'pending'`, so Better Auth's implicit linking would otherwise bind
 * the invitee's Google account to the row before the invitation is claimed
 * (the session login gate then refuses the session, but the link would stay).
 * The `credential` account is exempt: the claim itself writes the password
 * while the row is still `pending`.
 *
 * The thrown error carries `ACCOUNT_NOT_ACTIVE`, which Better Auth's OAuth
 * callback forwards as `?error=ACCOUNT_NOT_ACTIVE` to the error callback URL.
 * A missing owner is refused too (sign-up is disabled for social providers,
 * so a social account is never created together with a new user).
 *
 * @param loadOwner - Reads the owning user's status (Drizzle in production,
 * a fake in tests)
 */
export function socialAccountLinkGuard(
	loadOwner: (userId: string) => Promise<TAccountOwner | null>,
): AccountCreateBefore {
	return async (account, context) => {
		if (account.providerId === 'credential') return;
		const owner = await loadOwner(account.userId);
		if (owner && isAccountActive(owner)) return;
		const headers = (context as { headers?: Headers } | null | undefined)?.headers;
		throw new APIError('FORBIDDEN', {
			code: ACCOUNT_NOT_ACTIVE,
			message: translateForRequest('auth.accountNotActive', headers),
		});
	};
}
