import {
	TOrganizationSelect,
} from '@drizzle/schemas/auth.schema';
import { TPaginationRequest, TPaginationResult } from '@ims-erp/common';
import type { TOrganizationMember, TMemberRole } from './organization.contract';

/**
 * Pagination/filter parameters for organization listings. `includeDeleted`
 * is an admin-visibility escape hatch (single-org invariant still counts
 * soft-deleted rows regardless).
 */
export type TOrganizationPaginationRequest = TPaginationRequest & {
	includeDeleted?: boolean;
};

/**
 * Pagination/filter parameters for member listings. `role` is an exact
 * match against the member's (possibly comma-joined) role list.
 */
export type TMemberPaginationRequest = TPaginationRequest & {
	role?: TMemberRole;
};

/**
 * Data-access contract over the Better Auth–owned `auth.organizations` /
 * `auth.members` tables.
 *
 * @remarks
 * Module-boundary exception (see the `elysia-module` skill, rule 3.3): this
 * repository projects over the auth schema because Better Auth owns the
 * organization tables. The write surface is limited to `deletedAt` —
 * membership and profile mutations go through the auth gateway (Better Auth
 * API) instead.
 */
export interface IOrganizationRepository {
	/** Paginated listing; excludes soft-deleted rows unless asked. */
	paginate(
		request: TOrganizationPaginationRequest,
	): Promise<TPaginationResult<TOrganizationSelect>>;

	/** Finds by id, including soft-deleted rows. */
	findById(id: string): Promise<TOrganizationSelect | null>;

	/** Whether any organization row exists, soft-deleted included. */
	existsAny(): Promise<boolean>;

	/** Soft delete: stamps `deletedAt`. No-op when already deleted. */
	softDelete(id: string): Promise<void>;

	/** Restores a soft-deleted organization by clearing `deletedAt`. */
	restore(id: string): Promise<void>;

	/** Paginated member list joined with user identity fields. */
	paginateMembers(
		organizationId: string,
		request: TMemberPaginationRequest,
	): Promise<TPaginationResult<TOrganizationMember>>;

	/** Finds one member of an organization (for last-owner checks). */
	findMemberById(
		organizationId: string,
		memberId: string,
	): Promise<TOrganizationMember | null>;

	/** Counts active owners in an organization. */
	countOwners(organizationId: string): Promise<number>;
}
