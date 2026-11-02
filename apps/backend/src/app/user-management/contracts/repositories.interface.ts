import type { TUserInvitationSelect, TRoleSelect } from '@drizzle/schemas/role.schema';
import type { TUserSelect } from '@drizzle/schemas/auth.schema';
import type { TAuditLogSelect } from '@drizzle/schemas/audit.schema';
import type { AuditAction } from '@drizzle/schemas/audit.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { TPermissionGrant } from '../contracts/admin.contract';

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

/** Filters for the admin user listing (phase 4). */
export type TUserListRequest = {
	status?: string;
	/** Platform role (`admin` / `user`). */
	role?: string;
	/** Case-insensitive partial match on name, email or username. */
	search?: string;
	includeDeleted?: boolean;
	page: number;
	limit: number;
};

/** Admin user row with its active organization memberships. */
export type TAdminUserRow = {
	user: TUserSelect;
	organizations: Array<{ id: string; name: string; role: string }>;
};

/** Filters for the admin role listing (phase 4). */
export type TRoleListRequest = {
	organizationId: string;
	includeDeleted?: boolean;
};

/**
 * Data-access contract over the per-organization role master data
 * (`auth.roles`). Full write surface: role CRUD is an owner/app-admin
 * operation gated by the escalation guard in the service layer.
 */
export interface IRoleRepository {
	list(request: TRoleListRequest): Promise<TRoleSelect[]>;
	findById(roleId: string): Promise<TRoleSelect | null>;
	findByName(
		organizationId: string,
		name: string,
	): Promise<TRoleSelect | null>;
	/** Finds a soft-deleted role with the same name (delete/rename reuse). */
	findByNameIncludingDeleted(
		organizationId: string,
		name: string,
	): Promise<TRoleSelect | null>;
	create(input: {
		organizationId: string;
		name: string;
		rank: number;
		permissions: TPermissionGrant;
		isSystem: boolean;
	}): Promise<TRoleSelect>;
	update(
		roleId: string,
		patch: {
			name?: string;
			rank?: number;
			permissions?: TPermissionGrant;
		},
	): Promise<TRoleSelect>;
	softDelete(roleId: string): Promise<void>;
	/** Revives a soft-deleted role row (name reuse on create). */
	undelete(roleId: string): Promise<void>;
	/** Live members in the org holding exactly this role name. */
	countMembers(organizationId: string, roleName: string): Promise<number>;
	/** Resolves the org's live `member` role (bulk-invite typo fallback). */
	findMemberRole(organizationId: string): Promise<TRoleSelect | null>;
}

/** Filters for the admin audit listing (phase 4). */
export type TAuditListRequest = {
	action?: string;
	actorUserId?: string;
	targetType?: string;
	organizationId?: string;
	from?: Date;
	to?: Date;
	page: number;
	limit: number;
};

/** Data-access contract over the append-only `audit.audit_logs` table. */
/**
 * One entry to append to the audit ledger.
 *
 * @remarks
 * Lives in `contracts/` (not the service) because it is the repository's
 * write DTO - the service fills it in, the repository persists it.
 */
export type TAuditEntry = {
	actorUserId: string;
	actorEmail?: string | null;
	action: AuditAction;
	targetType: 'invitation' | 'user' | 'role' | 'member' | 'organization';
	targetId: string;
	organizationId?: string | null;
	meta?: Record<string, unknown>;
	/** Caller request context; extracted from the real request headers. */
	request?: { ip?: string | null; userAgent?: string | null };
};

export interface IAuditRepository {
	list(
		request: TAuditListRequest,
	): Promise<TPaginationResult<TAuditLogSelect>>;
	/** Appends one immutable audit row. */
	insert(entry: TAuditEntry): Promise<void>;
}

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
	/**
	 * Admin listing (phase 4): paginated users with their active
	 * organization memberships, filterable by status/role/search.
	 */
	listUsers(
		request: TUserListRequest,
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
