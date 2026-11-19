import { PORTAL_ACCOUNT_SERVICE_TOKEN } from '@app/user/constants/di';
import type { TPortalSignup } from '@app/user/contracts/portal-account.contract';
import type { PortalAccountService } from '@app/user/services/portal-account.service';
import type { IPortalSessionResolver, PortalContext } from '@authorization/portal-auth';
import type { ICacheClient } from '@cache/cache.client';
import { CACHE_CLIENT_TOKEN } from '@di/tokens';
import { inject, injectable } from 'tsyringe';
import { PORTAL_SESSION_GATEWAY_TOKEN } from '../constants/di';
import {
	type IPortalSessionGateway,
	PORTAL_CUSTOMER_ROLE,
	PORTAL_LOCK_SECONDS,
	PORTAL_MAX_FAILED_LOGINS,
	type TPortalLoginRequest,
	type TPortalSession,
} from '../contracts/portal.contract';
import { PortalInvalidCredentialsError, PortalInvalidTokenError, PortalLockedError, PortalWrongPasswordError } from '../errors/portal.errors';

type TFailedLogins = { count: number; lockedUntil: number | null };

/** A signed-in portal caller and the Better Auth session to hand to the portal's server. */
export type TPortalSignIn = { context: PortalContext; session: TPortalSession };

/**
 * Customer-portal sign-in, sessions and passwords (ERP-0022; ERP-0069).
 *
 * - Sign-in is email + password through Better Auth, accepted only for a
 *   login carrying the `customer` role AND an active customer portal
 *   identity. A staff login, an unknown email and a wrong password all
 *   answer the same 401.
 * - The session travels as Better Auth's session cookie between the ERP and
 *   the portal's server (ADR-0024); this service never returns it in a body.
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
		@inject(PORTAL_ACCOUNT_SERVICE_TOKEN)
		private readonly accounts: Pick<
			PortalAccountService,
			'resolveCustomer' | 'recordLogin' | 'requestPasswordReset' | 'startSignup' | 'verifySignup' | 'resendSignupCode'
		>,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: Pick<ICacheClient, 'get' | 'set' | 'del'>,
	) {}

	async login(body: TPortalLoginRequest, headers: Headers): Promise<TPortalSignIn> {
		const key = `portal:login-failures:${body.email}`;
		const failures = (await this.cache.get<TFailedLogins>(key)) ?? { count: 0, lockedUntil: null };
		if (failures.lockedUntil && failures.lockedUntil > Date.now()) throw new PortalLockedError();

		const session = await this.sessions.signIn(body.email, body.password, headers);
		const identity = session && isCustomer(session) ? await this.accounts.resolveCustomer(session.userId) : null;
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
		return { context: { ...identity, sessionToken: session.token }, session };
	}

	/** Owner decision D1: an individual signs up; a code goes to the email. */
	register(body: TPortalSignup): Promise<{ email: string }> {
		return this.accounts.startSignup(body);
	}

	resendVerification(email: string): Promise<void> {
		return this.accounts.resendSignupCode(email);
	}

	/** The right code creates the customer and an owner login and signs the person in. */
	async verifySignup(email: string, code: string): Promise<TPortalSignIn> {
		const identity = await this.accounts.verifySignup(email, code);
		const session = await this.sessions.createSession(identity.userId);
		if (!session || !isCustomer(session)) throw new PortalInvalidTokenError();
		await this.accounts.recordLogin(identity.identityId);
		return { context: { ...identity, sessionToken: session.token }, session };
	}

	/** {@link IPortalSessionResolver}: session cookie → `customer` role + active customer identity. */
	async resolve(headers: Headers): Promise<PortalContext | null> {
		const token = await this.sessions.tokenFromHeaders(headers);
		const session = token ? await this.sessions.getSession(token) : null;
		if (!session || !isCustomer(session)) return null;
		const identity = await this.accounts.resolveCustomer(session.userId);
		return identity ? { ...identity, sessionToken: session.token } : null;
	}

	/** `Set-Cookie` that hands a session to the portal's server. */
	sessionCookie(session: TPortalSession): Promise<string> {
		return this.sessions.sessionCookie(session);
	}

	/** `Set-Cookie` that clears the session cookie (sent on logout). */
	clearedSessionCookie(): Promise<string> {
		return this.sessions.clearedSessionCookie();
	}

	logout(portal: PortalContext): Promise<void> {
		return this.sessions.signOut(portal.sessionToken);
	}

	/** Always succeeds; an email is sent only to an active portal login. */
	requestPasswordReset(email: string): Promise<void> {
		return this.accounts.requestPasswordReset(email);
	}

	async confirmPasswordReset(token: string, password: string): Promise<void> {
		if (!(await this.sessions.resetPassword(token, password))) throw new PortalInvalidTokenError();
	}

	async changePassword(portal: PortalContext, current: string, next: string): Promise<void> {
		if (!(await this.sessions.changePassword(portal.sessionToken, current, next))) throw new PortalWrongPasswordError();
	}
}

/** Only a login carrying the global `customer` role may use the portal (ADR-0024). */
function isCustomer(session: TPortalSession): boolean {
	return session.roles.includes(PORTAL_CUSTOMER_ROLE);
}
