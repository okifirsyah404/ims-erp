import type { TPaginationResult } from '@ims-erp/common';
import type {
	TAssetCategoryInsert,
	TAssetCategorySelect,
} from '@drizzle/schemas/asset.schema';
import type { TTx } from '@drizzle/types';

/** Pagination + filters for the category list endpoint. */
export type TAssetCategoryPaginationRequest = {
	page: number;
	limit: number;
	/** Case-insensitive partial match on `code` or `name`. */
	search?: string;
	/** Exact asset-type filter. */
	assetType?: string;
	organizationId: string;
	/** Include archived (soft-deleted) rows. */
	includeArchived?: boolean;
};

/** Fields a client may set when creating a category. */
export type TAssetCategoryCreateData = Omit<
	TAssetCategoryInsert,
	'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'organizationId'
> & {
	createdAt?: Date;
	organizationId: string;
};

/** Fields a client may change on an existing category. */
export type TAssetCategoryUpdateData = Partial<
	Pick<
		TAssetCategoryInsert,
		| 'name'
		| 'parentCategoryId'
		| 'assetType'
		| 'defaultUsefulLifeMonths'
		| 'defaultDepreciationMethod'
		| 'isActive'
	>
>;

/**
 * Data-access contract over `assets.asset_categories`.
 *
 * @remarks
 * No service holds a Drizzle handle; every SQL statement against the table
 * lives behind this interface.
 */
export interface IAssetCategoryRepository {
	paginate(
		request: TAssetCategoryPaginationRequest,
	): Promise<TPaginationResult<TAssetCategorySelect>>;

	findById(id: string): Promise<TAssetCategorySelect | null>;

	/** Uniqueness probe for `(organizationId, code)` among alive rows. */
	findByCode(
		organizationId: string,
		code: string,
	): Promise<TAssetCategorySelect | null>;

	create(data: TAssetCategoryCreateData & { createdAt: Date }, tx?: TTx): Promise<TAssetCategorySelect>;

	update(
		id: string,
		data: TAssetCategoryUpdateData,
		tx?: TTx,
	): Promise<TAssetCategorySelect | null>;

	/** Soft delete. */
	archive(id: string, tx?: TTx): Promise<TAssetCategorySelect | null>;
}
