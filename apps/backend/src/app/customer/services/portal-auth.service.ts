import type { IPortalSessionResolver, PortalContext } from '@authorization/portal-auth';
import type { ICacheClient } from '@cache/cache.client';
import { CACHE_CLIENT_TOKEN } from '@di/tokens';
import { inject, injectable } from 'tsyringe';
import { PORTAL_ACCOUNT_SERVICE_TOKEN, PORTAL_SESSION_GATEWAY_TOKEN } from '../constants/di';
import type { TPortalSignup } from '../contracts/portal-account.contract';
import type { PortalAccountService } from './portal-account.service';
import {
	type IPortalSessionGateway,
	PORTAL_LOCK_SECONDS,
	PORTAL_MAX_FAILED_LOGINS,
	type TPortalDeviceSession,
	type TPortalLoginRequest,
	type TPortalSession,
} from '../contracts/portal.contract';
import {
	PortalDeviceNotFoundError,
	PortalInvalidCredentialsError,
	PortalInvalidTokenError,
	PortalLockedError,
	PortalWrongPasswordError,
} from '../errors/portal.errors';

type TFailedLogins = { count: number; lockedUntil: number | null };

/** A signed-in portal caller and the Better Auth session to hand to the portal's server. */
export type TPortalSignIn = { context: PortalContext; session: TPortalSession };

/** A signed-in device of the login; `current` is the one making the request. The token is never exposed. */
export type TPortalDevice = Omit<TPortalDeviceSession, 'token'> & { current: boolean };

/** The session token without the cookie signature (`<token>.<hmac>`), as Better Auth lists it. */
const rawToken = (cookieToken: string) => cookieToken.split('.')[0]!;

/**
 * Customer-portal sign-in, sessions and passwords (ERP-0022; ERP-0094).
 *
 * - Sign-in is email + password through Better Auth, accepted only for a
 *   login with an active customer portal login (`customer.customers`). A
 *   staff login, an unknown email and a wrong password all answer the same
 *   401. The global `customer` role is not checked here: the ERP cannot tell
 *   which client is calling, so it returns the user's roles and the customer
 *   portal admits only `customer` (ADR-0027 as amended 2026-11-21).
 * - The session travels as Better Auth's session cookie between the ERP and
 *   the portal's server (ADR-0027); this service never returns it in a body.
 * - Server-side calls bypass Better Auth's own rate limiter, so failed
 *   sign-ins are counted here per email (Redis): after
 *   {@link PORTAL_MAX_FAILED_LOGINS} the email is locked for
 *   {@link PORTAL_LOCK_SECONDS} (423).
 * - No two-step sign-in of its own: a second factor is Better Auth's job
 *   (owner decision 2026-11-21, not built yet).
 * - Implements the portal guard's {@link IPortalSessionResolver}.
 */
@injectable()
export class PortalAuthService implements IPortalSessionResolver {
	constructor(
		@inject(PORTAL_SESSION_GATEWAY_TOKEN) private readonly sessions: IPortalSessionGateway,
		@inject(PORTAL_ACCOUNT_SERVICE_TOKEN)
		private readonly accounts: Pick<
			PortalAccountService,
			| 'resolveCustomer'
			| 'recordLogin'
			| 'requestPasswordReset'
			| 'startSignup'
			| 'verifySignup'
			| 'resendSignupCode'
			| 'closeOwnLogin'
		>,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: Pick<ICacheClient, 'get' | 'set' | 'del'>,
	) {}

	/** Email + password. */
	async login(body: TPortalLoginRequest, headers: Headers): Promise<TPortalSignIn> {
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
		await this.accounts.recordLogin(identity.customerId);
		return { context: { ...identity, roles: session.roles, sessionToken: session.token }, session };
	}

	/* Devices and deleting the login (ERP-0106) ---------------------------- */

	async devices(portal: PortalContext): Promise<TPortalDevice[]> {
		const current = rawToken(portal.sessionToken);
		const sessions = await this.sessions.listSessions(portal.sessionToken);
		return sessions
			.map(({ token, ...device }) => ({ ...device, current: token === current }))
			.sort((a, b) => Number(b.current) - Number(a.current) || b.updatedAt.getTime() - a.updatedAt.getTime());
	}

	/** Signs one device out; the device is addressed by its session id, never its token. */
	async revokeDevice(portal: PortalContext, id: string): Promise<void> {
		const target = (await this.sessions.listSessions(portal.sessionToken)).find((session) => session.id === id);
		if (!target) throw new PortalDeviceNotFoundError();
		await this.sessions.revokeSession(portal.sessionToken, target.token);
	}

	revokeOtherDevices(portal: PortalContext): Promise<void> {
		return this.sessions.revokeOtherSessions(portal.sessionToken);
	}

	/**
	 * Deletes the caller's own login after the password: the login goes, the
	 * customer's data stays.
	 * @throws {PortalWrongPasswordError}
	 * @throws {PortalLastOwnerError} the only owner of a company account
	 */
	async closeAccount(portal: PortalContext, password: string): Promise<void> {
		if (!(await this.sessions.verifyPassword(portal.sessionToken, password))) throw new PortalWrongPasswordError();
		await this.accounts.closeOwnLogin(portal);
	}

	/** Owner decision D1: an individual signs up; a code goes to the email. */
	register(body: TPortalSignup): Promise<{ email: string }> {
		return this.accounts.startSignup(body);
	}

	resendVerification(email: string): Promise<void> {
		return this.accounts.resendSignupCode(email);
	}

	/** The right code creates the customer and an owner login and signs the person in. */
	async verifySignup(email: string, code: string, headers?: Headers): Promise<TPortalSignIn> {
		const identity = await this.accounts.verifySignup(email, code);
		// The request headers name the device in the devices list (ERP-0106).
		const session = await this.sessions.createSession(identity.userId, headers);
		if (!session) throw new PortalInvalidTokenError();
		await this.accounts.recordLogin(identity.customerId);
		return { context: { ...identity, roles: session.roles, sessionToken: session.token }, session };
	}

	/** {@link IPortalSessionResolver}: session cookie → active portal login, with the user's roles. */
	async resolve(headers: Headers): Promise<PortalContext | null> {
		const token = await this.sessions.tokenFromHeaders(headers);
		const session = token ? await this.sessions.getSession(token) : null;
		if (!session) return null;
		const identity = await this.accounts.resolveCustomer(session.userId);
		return identity ? { ...identity, roles: session.roles, sessionToken: session.token } : null;
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
