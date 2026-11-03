import type { TRoleSelect } from '@drizzle/schemas/role.schema';
import type { TPermissionGrant } from './admin.contract';

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
