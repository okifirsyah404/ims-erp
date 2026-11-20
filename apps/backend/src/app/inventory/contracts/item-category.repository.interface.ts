import type { TPaginationResult } from '@ims-erp/common';
import type {
	TItemCategoryInsert,
	TItemCategorySelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';

/** Pagination + filters for the category list endpoint. */
export type TItemCategoryPaginationRequest = {
	page: number;
	limit: number;
	/** Case-insensitive partial match on `code` or `name`. */
	search?: string;
	/** Exact asset-type filter. */
	itemKind?: string;
	organizationId: string;
	/** Include archived (soft-deleted) rows. */
	includeArchived?: boolean;
};

/** Fields a client may set when creating a category. */
export type TItemCategoryCreateData = Omit<
	TItemCategoryInsert,
	'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'organizationId'
> & {
	createdAt?: Date;
	organizationId: string;
};

/** Fields a client may change on an existing category. */
export type TItemCategoryUpdateData = Partial<
	Pick<
		TItemCategoryInsert,
		| 'name'
		| 'parentCategoryId'
		| 'itemKind'
		| 'defaultUsefulLifeMonths'
		| 'defaultDepreciationMethod'
		| 'isActive'
	>
>;

/**
 * Data-access contract over `items.asset_categories`.
 *
 * @remarks
 * No service holds a Drizzle handle; every SQL statement against the table
 * lives behind this interface.
 */
export interface IItemCategoryRepository {
	paginate(
		request: TItemCategoryPaginationRequest,
	): Promise<TPaginationResult<TItemCategorySelect>>;

	findById(id: string): Promise<TItemCategorySelect | null>;

	/** Uniqueness probe for `(organizationId, code)` among alive rows. */
	findByCode(
		organizationId: string,
		code: string,
	): Promise<TItemCategorySelect | null>;

	create(data: TItemCategoryCreateData & { createdAt: Date }, tx?: TTx): Promise<TItemCategorySelect>;

	update(
		id: string,
		data: TItemCategoryUpdateData,
		tx?: TTx,
	): Promise<TItemCategorySelect | null>;

	/** Soft delete. */
	archive(id: string, tx?: TTx): Promise<TItemCategorySelect | null>;
}
