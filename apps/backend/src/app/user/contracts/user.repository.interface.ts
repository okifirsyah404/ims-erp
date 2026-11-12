import {
	TUserInsert,
	TUserSelect,
} from '@drizzle/schemas/auth.schema';
import {
	IBaseRepository,
	TPaginationRequest,
	TPaginationResult,
} from '@ims-erp/common';

/**
 * Pagination and filter parameters for user listings.
 *
 * @remarks
 * `email`, `name`, `username`, and `role` act as optional search filters
 * (case-insensitive partial match); `banned` is an exact boolean filter.
 */
export type TUserPaginationRequest = TPaginationRequest &
	Partial<Pick<TUserInsert, 'email' | 'name' | 'username' | 'role'>> & {
		banned?: boolean;
	};

/**
 * Data-access contract over the Better Auth–owned `auth.users` table.
 *
 * @remarks
 * Module-boundary exception (see the `elysia-module` skill, rule 3.3): the
 * user module projects over the auth schema because Better Auth owns the
 * identity tables. Direct writes are limited to `deletedAt` and the personal
 * fields moved here from `hr.employees` (ERP-0034: gender, birth_date,
 * birth_place, marital_status), which Better Auth does not manage.
 * `role`, `banned`, `banReason`, `banExpires`, passwords, and sessions are
 * Better Auth–owned state and must be mutated exclusively through the
 * Better Auth admin API (see `IUserAuthGateway`), never via Drizzle.
 *
 * Soft-delete semantics follow {@link IBaseRepository}: reads exclude
 * soft-deleted rows unless named otherwise, `delete` marks rows deleted,
 * `restore` clears the marker. Note that Better Auth does not consult
 * `deletedAt` during authentication — the service pairs `delete` with an
 * admin-API ban to keep deleted users unable to log in.
 */
export interface IUserRepository
	extends IBaseRepository<TUserInsert, TUserSelect> {
	/**
	 * Fetches one page of users matching the given filters.
	 *
	 * @param request - Page settings plus optional filters
	 * @returns The matching page with pagination metadata
	 */
	paginate(
		request: TUserPaginationRequest,
	): Promise<TPaginationResult<TUserSelect>>;
}
