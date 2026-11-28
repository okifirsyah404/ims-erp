import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	ProductKind,
	TProductInsert,
	TProductSelect,
} from '@drizzle/schemas/product.schema';

/**
 * One item list row.
 *
 * @remarks
 * When the request carries `warehouseId`, the repository decorates each row
 * with the item's total `quantity_on_hand` in that warehouse (summed over
 * `stocks` bins, as a decimal string like the numeric column it comes
 * from). Without the filter the field is `null` — the plain item master does
 * not carry a per-warehouse quantity.
 */
export type TProductListRow = TProductSelect & {
	quantityOnHand?: string | null;
	/**
	 * Presigned display photo URL. Decorated by the controller
	 * (`ItemImageService.withImageUrl`), never by the repository — the
	 * repository has no storage dependency. Absent only before decoration.
	 */
	imageUrl?: string | null;
};

/** Pagination + filters for the item list endpoint. */
export type TProductPaginationRequest = {
	page: number;
	limit: number;
	/** Case-insensitive partial match on `sku` or `name`. */
	search?: string;
	/** Exact kind filter. */
	productKind?: ProductKind;
	/** Exact category (ADR-0011). */
	productCategoryId?: string;
	/** Only products offered for new documents (`is_active`). */
	activeOnly?: boolean;
	/**
	 * Only products with a physical presence in this warehouse: at least one live
	 * serialized unit **or** a stock balance. The second clause matters for
	 * quantity-tracked products, which have no units at all — their stock lives
	 * only in `stocks`.
	 */
	warehouseId?: string;
	/** Include archived (soft-deleted) rows. */
	includeArchived?: boolean;
	/** Lifecycle filter on `is_active`; wins over `activeOnly` when both are sent. */
	status?: 'all' | 'active' | 'inactive';
	/** Selling price range in IDR minor units, inclusive. */
	minPrice?: number;
	maxPrice?: number;
	/** Available quantity range summed over every bin, inclusive; no stock row = 0. */
	minStock?: number;
	maxStock?: number;
	/** Sort column; defaults to `name`. */
	sortBy?: 'name' | 'code' | 'price';
	sortDir?: 'asc' | 'desc';
};

/** Slider bounds for the list filters. */
export type TProductRanges = {
	/** Highest selling price among the live products, IDR minor units. */
	maxSellingPrice: number;
	/** Highest summed available quantity among the live products. */
	maxStock: number;
};

/**
 * Fields a client may set when creating an item.
 *
 * @remarks
 * `code` is not client-settable: ERP-0043 allocates it in `ItemService` from
 * the numbering authority, so the repository takes it as a separate argument
 * (`create(data, code)`).
 */
export type TProductCreateData = Omit<
	TProductInsert,
	'id' | 'code' | 'createdAt' | 'updatedAt' | 'deletedAt'
> & { createdAt?: Date };

/**
 * Fields a client may change on an existing item.
 *
 * @remarks
 * `code` joins `sku` and `productKind` as immutable: all three are load bearing
 * for uniqueness and for the numbering story.
 */
export type TProductUpdateData = Partial<
	Omit<
		TProductInsert,
		'id' | 'code' | 'sku' | 'productKind' | 'createdAt' | 'updatedAt'
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
export interface IProductRepository {
	/** Fetches one filtered page of products. */
	paginate(
		request: TProductPaginationRequest,
	): Promise<TPaginationResult<TProductListRow>>;

	/** Slider bounds (max price, max stock) for the live products of a kind. */
	ranges(productKind?: ProductKind): Promise<TProductRanges>;

	/** Fetches one alive item by id. */
	findById(id: string): Promise<TProductSelect | null>;

	/** Fetches the alive, active products among `ids` (missing ones are skipped). */
	findActiveByIds(ids: string[]): Promise<TProductSelect[]>;

	/** Fetches one alive item by tenant + SKU. */
	findBySku(
		organizationId: string | null,
		sku: string,
	): Promise<TProductSelect | null>;

	/** Inserts an item; the `code` comes from the numbering authority. */
	/** `tx` joins the caller's transaction (number allocation, P7-5). */
	create(data: TProductCreateData, code: string, tx?: TTx): Promise<TProductSelect>;

	/** Applies a partial update to an alive item. */
	update(id: string, data: TProductUpdateData): Promise<TProductSelect | null>;

	/** Soft-deletes an alive item. */
	archive(id: string): Promise<TProductSelect | null>;

	/**
	 * Fetches alive products by id, returning `{ id, name, imageObjectKey }` rows.
	 *
	 * @remarks
	 * Used to decorate stock rows with a human-readable item name and picture —
	 * balances and movements otherwise carry only the raw `productId`. The object
	 * key is turned into a URL by the caller (`ItemImageService.urlFor`), never
	 * here.
	 */
	findNamesByIds(
		ids: string[],
	): Promise<
		Array<{ id: string; name: string; sku: string; unitLabel: string; imageObjectKey: string | null }>
	>;

	/**
	 * Every product row for the ids, archived included.
	 *
	 * @remarks
	 * Another module's historical row (a stock balance, a document line) must
	 * still print its product's name and price snapshot after the product was
	 * archived, so this read does not filter `deleted_at`.
	 */
	findByIds(ids: string[]): Promise<TProductSelect[]>;

	/** Alive products whose kind matches one of `kinds` (best-effort label lookup). */
	productKinds(ids: string[]): Promise<Array<{ id: string; productKind: string }>>;

	/**
	 * Live products whose SKU or name matches the fragment.
	 *
	 * @remarks
	 * The stock value view filters by product text, so the matching ids are
	 * resolved here and applied as an `inArray` by the owning module's facade.
	 */
	searchByNameOrSku(search: string): Promise<Array<{ id: string }>>;

	/** Products that carry a website listing (a slug), live rows, newest edit first. */
	listListed(): Promise<TProductSelect[]>;

	/** Products on the public website: listed, published, active and live. */
	listPublished(): Promise<TProductSelect[]>;

	/** The live product that owns a listing slug, published or not. */
	findBySlug(slug: string): Promise<TProductSelect | null>;

	/** The published, active, live product behind a listing slug. */
	findPublishedBySlug(slug: string): Promise<TProductSelect | null>;

	/** Counts alive units of an item, used before archive. */
	countUnits(productId: string): Promise<number>;
}
