import type { TUserSelect } from '@drizzle/schemas/auth.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { TAdminUserRow, TUserPaginationRequest } from './admin-listing.types';

/**
 * Data-access contract over the user-management-owned columns of
 * `auth.users` (`status`, `phone`) plus pre-creation. Better Auth-owned
 * state (password, username, name) still flows through the auth gateway —
 * this repository is only the lifecycle/claim write surface.
 */
export interface IUserManagementRepository {
	findById(id: string): Promise<TUserSelect | null>;
	findByEmail(email: string): Promise<TUserSelect | null>;

	/**
	 * Finds a live, non-pending (active/deactivated) user by email — the
	 * cross-module "is this email already a real account" check (nested
	 * users on organization creation, ERP-0041). Pending pre-created rows
	 * do not count: they are invitation placeholders, not accounts.
	 */
	findActiveByEmail(email: string): Promise<TUserSelect | null>;
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
	/**
	 * Renames a still-pending (unclaimed) user, used when an invitation is
	 * re-sent for the same email with a different name. Never touches a
	 * claimed account — the owner's profile is theirs after claim.
	 */
	renamePendingUser(id: string, name: string): Promise<void>;
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
	/**
	 * Admin listing (phase 4): paginated users with their active
	 * organization memberships, filterable by status/role/search.
	 */
	paginateUsers(
		request: TUserPaginationRequest,
	): Promise<TPaginationResult<TAdminUserRow>>;
	/** Finds a user including soft-deleted rows by id (admin lifecycle). */
	findAnyById(id: string): Promise<TUserSelect | null>;
	/** Restores a deactivated user to `active` (lifecycle, not soft delete). */
	reactivate(id: string): Promise<void>;
	/** Active organization memberships of one user (rank guard). */
	listMemberships(
		userId: string,
	): Promise<Array<{ id: string; name: string; role: string }>>;
}
