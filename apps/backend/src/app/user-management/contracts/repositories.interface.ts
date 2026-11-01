import type { TUserInvitationSelect } from '@drizzle/schemas/role.schema';
import type { TUserSelect } from '@drizzle/schemas/auth.schema';
import type { TPaginationResult } from '@ims-erp/common';

/**
 * Filters for the invitation listing. `status` is exact; `email` is a
 * case-insensitive partial match.
 */
export type TInvitationListRequest = {
	status?: TUserInvitationSelect['status'];
	organizationId?: string;
	email?: string;
	page: number;
	limit: number;
};

/**
 * Data-access contract over `auth.user_invitations` (module-owned table,
 * full write surface). Soft-delete semantics: reads exclude deleted rows;
 * `delete` marks deleted.
 */
export interface IInvitationRepository {
	findById(id: string): Promise<TUserInvitationSelect | null>;
	/** Finds the live pending invitation for an email (overwrite rule). */
	findPendingByEmail(email: string): Promise<TUserInvitationSelect | null>;
	/** Finds a live invitation by token hash (claim validation). */
	findByTokenHash(tokenHash: string): Promise<TUserInvitationSelect | null>;
	list(
		request: TInvitationListRequest,
	): Promise<TPaginationResult<TUserInvitationSelect>>;
	create(input: TInvitationCreate): Promise<TUserInvitationSelect>;
	/** Replaces the token hash/expiry on resend; increments resentCount. */
	updateToken(
		id: string,
		token: { tokenHash: string; expiresAt: Date },
	): Promise<void>;
	markStatus(
		id: string,
		status: TUserInvitationSelect['status'],
		claimedAt?: Date,
	): Promise<void>;
	/** Soft-deletes a live invitation row. */
	delete(id: string): Promise<void>;
	setDeliveryFailed(id: string, failed: boolean): Promise<void>;
}

/** Insert shape accepted by {@link IInvitationRepository.create}. */
export type TInvitationCreate = {
	id: string;
	type: TUserInvitationSelect['type'];
	email: string;
	name: string | null;
	organizationId: string | null;
	roleId: string | null;
	tokenHash: string;
	invitedBy: string;
	expiresAt: Date;
};

/**
 * Data-access contract over the user-management-owned columns of
 * `auth.users` (`status`, `phone`) plus pre-creation. Better Auth-owned
 * state (password, username, name) still flows through the auth gateway —
 * this repository is only the lifecycle/claim write surface.
 */
export interface IUserManagementRepository {
	findById(id: string): Promise<TUserSelect | null>;
	findByEmail(email: string): Promise<TUserSelect | null>;
	/** True when no live user holds the username (claim availability). */
	isUsernameAvailable(username: string): Promise<boolean>;
	/** True when no live, active user holds the phone. */
	isPhoneAvailable(phone: string): Promise<boolean>;
	/**
	 * Pre-creates a pending user (invitation time): name + email only, no
	 * credentials. Returns the new user id.
	 */
	createPendingUser(input: {
		name: string;
		email: string;
	}): Promise<{ id: string }>;
	/** Sets lifecycle status; `deactivated` implies session revocation upstream. */
	setStatus(id: string, status: TUserSelect['status']): Promise<void>;
	/** Claim-time writes: phone + status active. */
	setClaimed(
		id: string,
		input: { phone: string },
	): Promise<void>;
	/** Soft-deletes a live user row (unclaimed invitation deletion). */
	delete(id: string): Promise<void>;
	/** Finds a user including soft-deleted rows (re-invite resolution). */
	findAnyByEmail(email: string): Promise<TUserSelect | null>;
	/** Clears `deletedAt` and re-pends a soft-deleted user for re-invite. */
	restore(id: string): Promise<void>;
}
