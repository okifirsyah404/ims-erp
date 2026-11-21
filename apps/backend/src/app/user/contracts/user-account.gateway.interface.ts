/** A Better Auth user as other modules may see it. */
export type TAuthUser = { id: string; name: string; email: string; emailVerified: boolean };

/**
 * Better Auth port for logins created outside the organization flow (users,
 * passwords, one-time password tokens, sessions) — what the customer portal
 * needs from the identity module.
 */
export interface IUserAccountGateway {
	findUserByEmail(email: string): Promise<TAuthUser | null>;
	findUserById(id: string): Promise<TAuthUser | null>;
	/** A user without any organization membership; `emailVerified` as given. */
	createUser(input: { name: string; email: string; emailVerified: boolean }): Promise<TAuthUser>;
	/** Sets (or replaces) the credential password through Better Auth's hasher. */
	setPassword(userId: string, password: string): Promise<void>;
	markEmailVerified(userId: string): Promise<void>;
	hasPassword(userId: string): Promise<boolean>;
	/** Issues a one-time token accepted by Better Auth's reset-password endpoint. */
	issuePasswordToken(userId: string, ttlSeconds: number): Promise<string>;
	revokeSessions(userId: string): Promise<void>;
	isOrganizationMember(userId: string): Promise<boolean>;
	/**
	 * Adds the global `customer` role (admin plugin, comma-joined `user.role`):
	 * the default `user` role is replaced, any other role is kept. The customer
	 * portal guard requires it (ADR-0027).
	 */
	grantCustomerRole(userId: string): Promise<void>;
}
