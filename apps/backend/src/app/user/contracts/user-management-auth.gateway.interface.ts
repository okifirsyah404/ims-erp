import type { TUserSelect } from '@drizzle/schemas/auth.schema';

/**
 * Better Auth surface needed by the user-management module. Wraps `auth.api`
 * so all credentials state (password, username) flows through Better Auth.
 */
export interface IUserManagementAuthGateway {
	/**
	 * Sets the initial password + username on a pre-created pending user at
	 * claim time (server-side `setUserPassword` + `adminUpdateUser`; no
	 * caller headers — the invitation token is the authorization).
	 *
	 * @throws ClaimError-subclasses translated by the implementation
	 */
	claimCredentials(input: {
		userId: string;
		username: string;
		password: string;
	}): Promise<void>;
	/** Revokes every session of a user (deactivate). */
	revokeSessions(userId: string): Promise<void>;
	/**
	 * Opens the user's first session via a standard credential sign-in
	 * (server-side); returns the set-cookie header for the response.
	 */
	createSession(
		userId: string,
		input: { password: string },
		headers: Headers,
	): Promise<{ setCookie: string | null }>;
	/**
	 * Org-path claim: creates the membership via Better Auth's addMember
	 * (server-side; the invitation token is the authority) and resolves the
	 * organization name from Better Auth's internal adapter —
	 * `getFullOrganization` requires a caller session, which a claim lacks.
	 *
	 * @returns The organization display name
	 */
	attachMembership(input: {
		userId: string;
		organizationId: string;
		roleName: string;
	}): Promise<string>;
}

/** Claims a pending user shape (invitation + user rows joined). */
export type TClaimTarget = {
	invitation: {
		id: string;
		type: 'app' | 'org';
		organizationId: string | null;
		roleId: string | null;
	};
	user: Pick<TUserSelect, 'id' | 'name' | 'email' | 'status'>;
};
