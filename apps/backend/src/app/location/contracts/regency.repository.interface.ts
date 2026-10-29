import {
	TRegencyInsert,
	TRegencySelect,
} from '@drizzle/schemas/location.schema';
import {
	IBaseRepository,
	TPaginationRequest,
	TPaginationResult,
} from '@ims-erp/common';

/**
 * Pagination and filter parameters for regency listings.
 *
 * @remarks
 * `code` and `name` act as optional search filters (applied via
 * case-insensitive partial match), not as create data.
 */
export type TRegencyPaginationRequest = TPaginationRequest &
	Partial<Pick<TRegencyInsert, 'code' | 'name' | 'provinceId'>>;

/**
 * Data-access contract for regencies (kabupaten/kota) within a province.
 *
 * @remarks
 * Follows the soft-delete convention of {@link IBaseRepository}: reads
 * exclude soft-deleted rows unless named otherwise, `delete` marks rows
 * deleted, and `forceDelete` removes them permanently. Hot reads are
 * served through a Redis cache-aside layer that is invalidated on writes.
 * The `findByProvince*` lookups resolve the parent first when given codes;
 * an unknown code yields an empty array, not an error.
 */
export interface IRegencyRepository extends IBaseRepository<
	TRegencyInsert,
	TRegencySelect
> {
	/**
	 * Fetches one page of regencies matching the given filters.
	 *
	 * @param request - Page settings plus optional `code`/`name`/`provinceId` filters
	 * @returns The matching page with pagination metadata
	 */
	paginate(
		request: TRegencyPaginationRequest,
	): Promise<TPaginationResult<TRegencySelect>>;

	/**
	 * Fetches all non-deleted regencies belonging to one province.
	 *
	 * @param provinceId - The parent province identifier
	 * @returns The regencies, ordered by name
	 */
	findByProvinceId(provinceId: string): Promise<TRegencySelect[]>;

	/**
	 * Fetches all non-deleted regencies belonging to the given provinces.
	 *
	 * @param provinceIds - The parent province identifiers
	 * @returns The regencies; results from different provinces are not grouped
	 */
	findByProvinceIds(provinceIds: string[]): Promise<TRegencySelect[]>;

	/**
	 * Fetches all non-deleted regencies belonging to one province, resolved by its code.
	 *
	 * @param provinceCode - The parent province code (e.g. BPS code)
	 * @returns The regencies, or an empty array when the code is unknown
	 */
	findByProvinceCode(provinceCode: string): Promise<TRegencySelect[]>;

	/**
	 * Fetches all non-deleted regencies for the given province codes.
	 *
	 * @param provinceCodes - The parent province codes (e.g. BPS codes)
	 * @returns The regencies; results from different provinces are not grouped
	 */
	findByProvinceCodes(provinceCodes: string[]): Promise<TRegencySelect[]>;
}
