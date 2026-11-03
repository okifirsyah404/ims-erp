import type { TPaginationResult } from '@ims-erp/common';
import type {
	ItemKind,
	TItemInsert,
	TItemSelect,
} from '@drizzle/schemas/inventory.schema';

/** Pagination + filters for the item list endpoint. */
export type TItemPaginationRequest = {
	page: number;
	limit: number;
	/** Case-insensitive partial match on `sku` or `name`. */
	search?: string;
	/** Exact kind filter. */
	itemKind?: ItemKind;
	/** Case-insensitive partial match on the free-text category. */
	category?: string;
	/**
	 * Only items with at least one live serialized unit in this warehouse.
	 *
	 * @remarks
	 * Non-serialized quantity-tracked items have no units and are therefore
	 * excluded when this filter is set — the units are the only physical
	 * presence the schema can join on.
	 */
	warehouseId?: string;
	/** Include archived (soft-deleted) rows. */
	includeArchived?: boolean;
};

/** Fields a client may set when creating an item. */
export type TItemCreateData = Omit<
	TItemInsert,
	'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
> & { createdAt?: Date };

/** Fields a client may change on an existing item. */
export type TItemUpdateData = Partial<
	Omit<TItemInsert, 'id' | 'sku' | 'itemKind' | 'createdAt' | 'updatedAt'>
>;

/**
 * Item persistence contract.
 *
 * @remarks
 * Reads exclude soft-deleted rows unless a `*WithDeleted` method is called
 * explicitly. `organizationId` is nullable by design: `null` selects global
 * inventory, never "every organization".
 */
export interface IItemRepository {
	/** Fetches one filtered page of items. */
	paginate(
		request: TItemPaginationRequest,
	): Promise<TPaginationResult<TItemSelect>>;

	/** Fetches one alive item by id. */
	findById(id: string): Promise<TItemSelect | null>;

	/** Fetches one alive item by tenant + SKU. */
	findBySku(
		organizationId: string | null,
		sku: string,
	): Promise<TItemSelect | null>;

	/** Inserts an item. */
	create(data: TItemCreateData): Promise<TItemSelect>;

	/** Applies a partial update to an alive item. */
	update(id: string, data: TItemUpdateData): Promise<TItemSelect | null>;

	/** Soft-deletes an alive item. */
	archive(id: string): Promise<TItemSelect | null>;

	/** Counts alive units of an item, used before archive. */
	countUnits(itemId: string): Promise<number>;
}
