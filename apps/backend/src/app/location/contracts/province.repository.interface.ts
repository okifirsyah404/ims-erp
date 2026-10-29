import {
	TProvinceInsert,
	TProvinceSelect,
} from '@drizzle/schemas/location.schema';
import {
	IBaseRepository,
	TPaginationRequest,
	TPaginationResult,
} from '@ims-erp/common';

/**
 * Pagination and filter parameters for province listings.
 *
 * @remarks
 * `code` and `name` act as optional search filters (applied via
 * case-insensitive partial match), not as create data.
 */
export type TProvincePaginationRequest = TPaginationRequest &
	Partial<Pick<TProvinceInsert, 'code' | 'name'>>;

/**
 * Data-access contract for provinces, the root of the Indonesian
 * administrative hierarchy (province > regency > district > village).
 *
 * @remarks
 * Follows the soft-delete convention of {@link IBaseRepository}: reads
 * exclude soft-deleted rows unless named otherwise, `delete` marks rows
 * deleted, and `forceDelete` removes them permanently. Hot reads are
 * served through a Redis cache-aside layer that is invalidated on writes.
 */
export interface IProvinceRepository extends IBaseRepository<
	TProvinceInsert,
	TProvinceSelect
> {
	/**
	 * Fetches one page of provinces matching the given filters.
	 *
	 * @param request - Page settings plus optional `code`/`name` filters
	 * @returns The matching page with pagination metadata
	 */
	paginate(
		request: TProvincePaginationRequest,
	): Promise<TPaginationResult<TProvinceSelect>>;
}
