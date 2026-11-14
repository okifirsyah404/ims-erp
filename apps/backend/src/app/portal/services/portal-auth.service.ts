import { PORTAL_ACCOUNT_SERVICE_TOKEN } from '@app/user/constants/di';
import type { PortalAccountService } from '@app/user/services/portal-account.service';
import type { IPortalSessionResolver, PortalContext } from '@authorization/portal-auth';
import type { ICacheClient } from '@cache/cache.client';
import { CACHE_CLIENT_TOKEN } from '@di/tokens';
import { inject, injectable } from 'tsyringe';
import { PORTAL_SESSION_GATEWAY_TOKEN } from '../constants/di';
import {
	type IPortalSessionGateway,
	PORTAL_LOCK_SECONDS,
	PORTAL_MAX_FAILED_LOGINS,
	type TPortalLoginRequest,
} from '../contracts/portal.contract';
import { PortalInvalidCredentialsError, PortalInvalidTokenError, PortalLockedError, PortalWrongPasswordError } from '../errors/portal.errors';

type TFailedLogins = { count: number; lockedUntil: number | null };

/**
 * Customer-portal sign-in, sessions and passwords (ERP-0022).
 *
 * - Sign-in is email + password through Better Auth, accepted only for a
 *   login with an active customer portal identity. A staff login, an unknown
 *   email and a wrong password all answer the same 401.
 * - Server-side calls bypass Better Auth's own rate limiter, so failed
 *   sign-ins are counted here per email (Redis): after
 *   {@link PORTAL_MAX_FAILED_LOGINS} the email is locked for
 *   {@link PORTAL_LOCK_SECONDS} (423).
 * - Implements the portal guard's {@link IPortalSessionResolver}.
 */
@injectable()
export class PortalAuthService implements IPortalSessionResolver {
	constructor(
		@inject(PORTAL_SESSION_GATEWAY_TOKEN) private readonly sessions: IPortalSessionGateway,
		@inject(PORTAL_ACCOUNT_SERVICE_TOKEN) private readonly accounts: Pick<PortalAccountService, 'resolveCustomer' | 'recordLogin' | 'requestPasswordReset'>,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: Pick<ICacheClient, 'get' | 'set' | 'del'>,
	) {}

	async login(body: TPortalLoginRequest, headers: Headers): Promise<{ context: PortalContext; expiresAt: Date }> {
		const key = `portal:login-failures:${body.email}`;
		const failures = (await this.cache.get<TFailedLogins>(key)) ?? { count: 0, lockedUntil: null };
		if (failures.lockedUntil && failures.lockedUntil > Date.now()) throw new PortalLockedError();

		const session = await this.sessions.signIn(body.email, body.password, headers);
		const identity = session ? await this.accounts.resolveCustomer(session.userId) : null;
		if (!session || !identity) {
			// A valid staff login must not keep a session it cannot use here.
			if (session) await this.sessions.signOut(session.token);
			const count = failures.count + 1;
			const locked = count >= PORTAL_MAX_FAILED_LOGINS;
			await this.cache.set<TFailedLogins>(
				key,
				{ count: locked ? 0 : count, lockedUntil: locked ? Date.now() + PORTAL_LOCK_SECONDS * 1000 : null },
				PORTAL_LOCK_SECONDS,
			);
			throw locked ? new PortalLockedError() : new PortalInvalidCredentialsError();
		}

		await this.cache.del(key);
		await this.accounts.recordLogin(identity.identityId);
		return {
			context: { ...identity, accessToken: session.token },
			expiresAt: session.expiresAt,
		};
	}

	/** {@link IPortalSessionResolver}: bearer token → active customer identity. */
	async resolve(accessToken: string): Promise<PortalContext | null> {
		const session = await this.sessions.getSession(accessToken);
		if (!session) return null;
		const identity = await this.accounts.resolveCustomer(session.userId);
		return identity ? { ...identity, accessToken } : null;
	}

	logout(portal: PortalContext): Promise<void> {
		return this.sessions.signOut(portal.accessToken);
	}

	/** Always succeeds; an email is sent only to an active portal login. */
	requestPasswordReset(email: string): Promise<void> {
		return this.accounts.requestPasswordReset(email);
	}

	async confirmPasswordReset(token: string, password: string): Promise<void> {
		if (!(await this.sessions.resetPassword(token, password))) throw new PortalInvalidTokenError();
	}

	async changePassword(portal: PortalContext, current: string, next: string): Promise<void> {
		if (!(await this.sessions.changePassword(portal.accessToken, current, next))) throw new PortalWrongPasswordError();
	}
}
