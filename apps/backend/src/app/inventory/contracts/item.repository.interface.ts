import type { TPaginationResult } from '@ims-erp/common';
import type {
	ItemKind,
	TItemInsert,
	TItemSelect,
} from '@drizzle/schemas/inventory.schema';

/**
 * One item list row.
 *
 * @remarks
 * When the request carries `warehouseId`, the repository decorates each row
 * with the item's total `quantity_on_hand` in that warehouse (summed over
 * `stock_balances` bins, as a decimal string like the numeric column it comes
 * from). Without the filter the field is `null` — the plain item master does
 * not carry a per-warehouse quantity.
 */
export type TItemListRow = TItemSelect & {
	quantityOnHand?: string | null;
	/**
	 * Presigned display photo URL. Decorated by the controller
	 * (`ItemImageService.withImageUrl`), never by the repository — the
	 * repository has no storage dependency. Absent only before decoration.
	 */
	imageUrl?: string | null;
};

/** Pagination + filters for the item list endpoint. */
export type TItemPaginationRequest = {
	page: number;
	limit: number;
	/** Case-insensitive partial match on `sku` or `name`. */
	search?: string;
	/** Exact kind filter. */
	itemKind?: ItemKind;
	/** Exact category (ADR-0011). */
	categoryId?: string;
	/** Only items offered for new documents (`is_active`). */
	activeOnly?: boolean;
	/**
	 * Only items with a physical presence in this warehouse: at least one live
	 * serialized unit **or** a stock balance. The second clause matters for
	 * quantity-tracked items, which have no units at all — their stock lives
	 * only in `stock_balances`.
	 */
	warehouseId?: string;
	/** Include archived (soft-deleted) rows. */
	includeArchived?: boolean;
};

/**
 * Fields a client may set when creating an item.
 *
 * @remarks
 * `code` is not client-settable: ERP-0043 allocates it in `ItemService` from
 * the numbering authority, so the repository takes it as a separate argument
 * (`create(data, code)`).
 */
export type TItemCreateData = Omit<
	TItemInsert,
	'id' | 'code' | 'createdAt' | 'updatedAt' | 'deletedAt'
> & { createdAt?: Date };

/**
 * Fields a client may change on an existing item.
 *
 * @remarks
 * `code` joins `sku` and `itemKind` as immutable: all three are load bearing
 * for uniqueness and for the numbering story.
 */
export type TItemUpdateData = Partial<
	Omit<
		TItemInsert,
		'id' | 'code' | 'sku' | 'itemKind' | 'createdAt' | 'updatedAt'
	>
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
	): Promise<TPaginationResult<TItemListRow>>;

	/** Fetches one alive item by id. */
	findById(id: string): Promise<TItemSelect | null>;

	/** Fetches the alive, active items among `ids` (missing ones are skipped). */
	findActiveByIds(ids: string[]): Promise<TItemSelect[]>;

	/** Fetches one alive item by tenant + SKU. */
	findBySku(
		organizationId: string | null,
		sku: string,
	): Promise<TItemSelect | null>;

	/** Inserts an item; the `code` comes from the numbering authority. */
	create(data: TItemCreateData, code: string): Promise<TItemSelect>;

	/** Applies a partial update to an alive item. */
	update(id: string, data: TItemUpdateData): Promise<TItemSelect | null>;

	/** Soft-deletes an alive item. */
	archive(id: string): Promise<TItemSelect | null>;

	/**
	 * Fetches alive items by id, returning `{ id, name }` pairs.
	 *
	 * @remarks
	 * Used to decorate stock rows with human-readable item names — balances
	 * and movements otherwise carry only the raw `itemId`.
	 */
	findNamesByIds(ids: string[]): Promise<Array<{ id: string; name: string }>>;

	/** Counts alive units of an item, used before archive. */
	countUnits(itemId: string): Promise<number>;
}
