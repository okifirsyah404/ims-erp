import type { TSetUserRole, TUpdateUser } from './user.contract';

/** Data required to create a user through the Better Auth admin API. */
export type TAuthGatewayCreateUser = {
	email: string;
	password: string;
	name: string;
	username?: string;
	role?: string;
	bio?: string;
};

/**
 * Port for every Better Auth–owned user mutation: profile fields, role,
 * ban state, and session handling.
 *
 * @remarks
 * Implementations wrap the Better Auth admin API (`auth.api.*`) so that
 * password hashing, database hooks, and session handling remain inside
 * Better Auth. The user module's repository must never write these
 * columns directly.
 *
 * All methods take the caller's request `headers` because the admin
 * endpoints (`/admin/update-user`, `/admin/set-role`, `/admin/ban-user`,
 * `/admin/unban-user`) run Better Auth's own admin-authorization check
 * against the calling session; only `/admin/create-user` is server-facing.
 * `createUser` receives the same parameter for symmetry but ignores it.
 */
export interface IUserAuthGateway {
	/**
	 * Creates a user with a password (and optional role/username).
	 *
	 * @returns The created user's id
	 * @throws UserEmailTakenError When the email or username already exists
	 */
	createUser(
		input: TAuthGatewayCreateUser,
		headers: Headers,
	): Promise<{ id: string }>;

	/**
	 * Updates profile fields (name, username, bio, image).
	 *
	 * @throws UserNotFoundError When the target user does not exist
	 */
	updateUser(userId: string, input: TUpdateUser, headers: Headers): Promise<void>;

	/**
	 * Self-service profile update for the calling user (no admin rights
	 * needed).
	 *
	 * @remarks
	 * Runs Better Auth's session-authenticated `/update-user` endpoint
	 * (NOT the admin API, which requires a global-admin caller). The
	 * username plugin validates/normalizes `username` on this endpoint and
	 * raises a 422-style APIError when it is already taken.
	 *
	 * @throws UserEmailTakenError When the username/email is taken
	 * @throws UserNotFoundError When the session user no longer exists
	 */
	updateSelf(userId: string, input: TUpdateUser, headers: Headers): Promise<void>;

	/**
	 * Replaces the user's global role.
	 *
	 * @throws UserNotFoundError When the target user does not exist
	 */
	setRole(
		userId: string,
		input: TSetUserRole,
		headers: Headers,
	): Promise<void>;

	/**
	 * Bans the user (optionally time-boxed) and revokes their sessions.
	 *
	 * @throws UserNotFoundError When the target user does not exist
	 */
	banUser(
		userId: string,
		input: { banReason?: string; banExpiresIn?: number },
		headers: Headers,
	): Promise<void>;

	/**
	 * Lifts an existing ban.
	 *
	 * @throws UserNotFoundError When the target user does not exist
	 */
	unbanUser(userId: string, headers: Headers): Promise<void>;
}
