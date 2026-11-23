/** A Better Auth user as other modules may see it. */
export type TAuthUser = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	/** Better Auth username plugin; `null` for logins created without one. */
	username?: string | null;
	/** Stored S3 object key of the avatar (never a URL); `null` without one. */
	image?: string | null;
};

/**
 * Better Auth port for logins created outside the organization flow (users,
 * passwords, one-time password tokens, sessions) — what the customer portal
 * needs from the identity module.
 */
export interface IUserAccountGateway {
	findUserByEmail(email: string): Promise<TAuthUser | null>;
	findUserById(id: string): Promise<TAuthUser | null>;
	/** A user without any organization membership; `emailVerified` as given. */
	createUser(input: { name: string; email: string; emailVerified: boolean; username?: string }): Promise<TAuthUser>;
	/** Users by id (missing ids are skipped); one query. */
	findUsersByIds(ids: string[]): Promise<TAuthUser[]>;
	/** Ids of users whose email contains `term` (case-insensitive), at most `limit`. */
	findUserIdsByEmailLike(term: string, limit: number): Promise<string[]>;
	/** Whether any user (live or deleted) holds this username (stored lower-case). */
	isUsernameTaken(username: string): Promise<boolean>;
	/** Updates profile fields Better Auth owns (name, email, image key). */
	updateUser(userId: string, patch: { name?: string; email?: string; image?: string | null }): Promise<void>;
	/** Hard-deletes a user that was just created and never used (compensation of a failed create). */
	deleteUser(userId: string): Promise<void>;
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
