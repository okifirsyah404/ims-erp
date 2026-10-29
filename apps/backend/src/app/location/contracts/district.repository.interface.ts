import {
	TDistrictInsert,
	TDistrictSelect,
} from '@drizzle/schemas/location.schema';
import {
	IBaseRepository,
	TPaginationRequest,
	TPaginationResult,
} from '@ims-erp/common';

/**
 * Pagination and filter parameters for district listings.
 *
 * @remarks
 * `code` and `name` act as optional search filters (applied via
 * case-insensitive partial match), not as create data.
 */
export type TDistrictPaginationRequest = TPaginationRequest &
	Partial<Pick<TDistrictInsert, 'code' | 'name' | 'regencyId'>>;

/**
 * Data-access contract for districts within a regency.
 *
 * @remarks
 * Follows the soft-delete convention of {@link IBaseRepository}: reads
 * exclude soft-deleted rows unless named otherwise, `delete` marks rows
 * deleted, and `forceDelete` removes them permanently. Hot reads are
 * served through a Redis cache-aside layer that is invalidated on writes.
 */
export interface IDistrictRepository extends IBaseRepository<
	TDistrictInsert,
	TDistrictSelect
> {
	/**
	 * Fetches one page of districts matching the given filters.
	 *
	 * @param request - Page settings plus optional `code`/`name`/`regencyId` filters
	 * @returns The matching page with pagination metadata
	 */
	paginate(
		request: TDistrictPaginationRequest,
	): Promise<TPaginationResult<TDistrictSelect>>;

	/**
	 * Fetches all non-deleted districts belonging to one regency.
	 *
	 * @param regencyId - The parent regency identifier
	 * @returns The districts, ordered by name
	 */
	findByRegencyId(regencyId: string): Promise<TDistrictSelect[]>;

	/**
	 * Fetches all non-deleted districts belonging to the given regencies.
	 *
	 * @param regencyIds - The parent regency identifiers
	 * @returns The districts; results from different regencies are not grouped
	 */
	findByRegencyIds(regencyIds: string[]): Promise<TDistrictSelect[]>;

	/**
	 * Fetches all non-deleted districts belonging to one regency, resolved by its code.
	 *
	 * @param regencyCode - The parent regency code (e.g. BPS code)
	 * @returns The districts, or an empty array when the code is unknown
	 */
	findByRegencyCode(regencyCode: string): Promise<TDistrictSelect[]>;

	/**
	 * Fetches all non-deleted districts for the given regency codes.
	 *
	 * @param regencyCodes - The parent regency codes (e.g. BPS codes)
	 * @returns The districts; results from different regencies are not grouped
	 */
	findByRegencyCodes(regencyCodes: string[]): Promise<TDistrictSelect[]>;
}
