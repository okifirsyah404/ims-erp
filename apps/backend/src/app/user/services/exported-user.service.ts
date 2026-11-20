import { inject, injectable } from 'tsyringe';
import { USER_ACCOUNT_GATEWAY_TOKEN } from '../constants/di';
import type { IUserAccountGateway, TAuthUser } from '../contracts/user-account.gateway.interface';

/**
 * Facade over the identity module for other modules (ADR-0024 Q5, Q9).
 *
 * @remarks
 * The customer portal owns its login state (`customer.customers.user_id` and
 * the portal columns) but never touches Better Auth or `auth.*` tables: users
 * and credentials are created and read here. Depends only on the Better Auth
 * gateway, so a consumer that itself depends on other modules cannot create a
 * cycle.
 */
@injectable()
export class ExportedUserService {
	constructor(
		@inject(USER_ACCOUNT_GATEWAY_TOKEN)
		private readonly accounts: IUserAccountGateway,
	) {}

	findByEmail(email: string): Promise<TAuthUser | null> {
		return this.accounts.findUserByEmail(email);
	}

	findById(id: string): Promise<TAuthUser | null> {
		return this.accounts.findUserById(id);
	}

	/**
	 * Creates a login that is not an organization member (a portal user never
	 * passes the `erp` guard).
	 */
	createPortalLogin(input: { name: string; email: string; emailVerified: boolean }): Promise<TAuthUser> {
		return this.accounts.createUser(input);
	}

	/** A staff login (organization member); such an email may never become a portal login. */
	isStaff(userId: string): Promise<boolean> {
		return this.accounts.isOrganizationMember(userId);
	}

	setPassword(userId: string, password: string): Promise<void> {
		return this.accounts.setPassword(userId, password);
	}

	markEmailVerified(userId: string): Promise<void> {
		return this.accounts.markEmailVerified(userId);
	}

	hasPassword(userId: string): Promise<boolean> {
		return this.accounts.hasPassword(userId);
	}

	/** One-time token for Better Auth's reset-password endpoint (first password or reset). */
	issuePasswordToken(userId: string, ttlSeconds: number): Promise<string> {
		return this.accounts.issuePasswordToken(userId, ttlSeconds);
	}

	/** Ends every session of the user; the user row stays (history). */
	revokeSessions(userId: string): Promise<void> {
		return this.accounts.revokeSessions(userId);
	}
}
