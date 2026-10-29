import {
	TVillageInsert,
	TVillageSelect,
} from '@drizzle/schemas/location.schema';
import {
	IBaseRepository,
	TPaginationRequest,
	TPaginationResult,
} from '@ims-erp/common';

/**
 * Pagination and filter parameters for village listings.
 *
 * @remarks
 * `code` and `name` act as optional search filters (applied via
 * case-insensitive partial match), not as create data. Villages cover
 * both kelurahan and desa in the Indonesian administrative hierarchy.
 */
export type TVillagePaginationRequest = TPaginationRequest &
	Partial<Pick<TVillageInsert, 'code' | 'name' | 'districtId'>>;

/**
 * Data-access contract for villages within a district.
 *
 * @remarks
 * Follows the soft-delete convention of {@link IBaseRepository}: reads
 * exclude soft-deleted rows unless named otherwise, `delete` marks rows
 * deleted, and `forceDelete` removes them permanently. Hot reads are
 * served through a Redis cache-aside layer that is invalidated on writes.
 */
export interface IVillageRepository extends IBaseRepository<
	TVillageInsert,
	TVillageSelect
> {
	/**
	 * Fetches one page of villages matching the given filters.
	 *
	 * @param request - Page settings plus optional `code`/`name`/`districtId` filters
	 * @returns The matching page with pagination metadata
	 */
	paginate(
		request: TVillagePaginationRequest,
	): Promise<TPaginationResult<TVillageSelect>>;

	/**
	 * Fetches all non-deleted villages belonging to one district.
	 *
	 * @param districtId - The parent district identifier
	 * @returns The villages, ordered by name
	 */
	findByDistrictId(districtId: string): Promise<TVillageSelect[]>;

	/**
	 * Fetches all non-deleted villages belonging to the given districts.
	 *
	 * @param districtIds - The parent district identifiers
	 * @returns The villages; results from different districts are not grouped
	 */
	findByDistrictIds(districtIds: string[]): Promise<TVillageSelect[]>;

	/**
	 * Fetches all non-deleted villages belonging to one district, resolved by its code.
	 *
	 * @param districtCode - The parent district code (e.g. BPS code)
	 * @returns The villages, or an empty array when the code is unknown
	 */
	findByDistrictCode(districtCode: string): Promise<TVillageSelect[]>;

	/**
	 * Fetches all non-deleted villages for the given district codes.
	 *
	 * @param districtCodes - The parent district codes (e.g. BPS codes)
	 * @returns The villages; results from different districts are not grouped
	 */
	findByDistrictCodes(districtCodes: string[]): Promise<TVillageSelect[]>;
}
