/**
 * URL search params of the product / component / material lists.
 *
 * @remarks
 * Only `page` and the filters live in the address; the page size is a frontend
 * constant, so a shared link never pins a stale limit. A filter change resets
 * `page` (the route does that), because page 4 of a narrower result may not exist.
 * Prices are whole/decimal **rupiah** here (what a person types); the API
 * client converts them to minor units.
 */
export const ITEM_SORT_FIELDS = ['name', 'code', 'price'] as const;
export type TItemSortField = (typeof ITEM_SORT_FIELDS)[number];
export const ITEM_STATUS_VALUES = ['active', 'inactive'] as const;
export type TItemStatus = (typeof ITEM_STATUS_VALUES)[number];

export type TItemListFilters = {
	/** Case-insensitive match on name, SKU or brand (what `GET /products?search=` covers). */
	q?: string;
	/** Product category id. */
	categoryId?: string;
	/** Lifecycle: absent = every live item. */
	status?: TItemStatus;
	/** Selling price range in rupiah, inclusive. */
	minPrice?: number;
	maxPrice?: number;
	/** On-hand quantity range (summed over every bin), inclusive. */
	minStock?: number;
	maxStock?: number;
	sortBy?: TItemSortField;
	sortDir?: 'asc' | 'desc';
};

/**
 * Every filter key set to `undefined`. A route merges it under the new filters
 * so a key the popover left out is cleared from the address instead of kept.
 */
export const EMPTY_ITEM_FILTERS: Record<keyof TItemListFilters, undefined> = {
	q: undefined,
	categoryId: undefined,
	status: undefined,
	minPrice: undefined,
	maxPrice: undefined,
	minStock: undefined,
	maxStock: undefined,
	sortBy: undefined,
	sortDir: undefined,
};

export type TItemListSearch = TItemListFilters & {
	page?: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A non-negative finite number from a URL value, else `undefined`. */
function amount(value: unknown): number | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** `validateSearch` for the three item list routes. */
export function validateItemListSearch(search: Record<string, unknown>): TItemListSearch {
	const q = typeof search.q === 'string' ? search.q.trim() : '';
	return {
		page: search.page ? Number(search.page) || 1 : undefined,
		q: q || undefined,
		categoryId: typeof search.categoryId === 'string' && UUID.test(search.categoryId) ? search.categoryId : undefined,
		// `activeOnly=true` is the pre-filter-popover link shape and still reads as `active`.
		status: ITEM_STATUS_VALUES.includes(search.status as TItemStatus)
			? (search.status as TItemStatus)
			: search.activeOnly === true || search.activeOnly === 'true'
				? 'active'
				: undefined,
		minPrice: amount(search.minPrice),
		maxPrice: amount(search.maxPrice),
		minStock: amount(search.minStock),
		maxStock: amount(search.maxStock),
		sortBy: ITEM_SORT_FIELDS.includes(search.sortBy as TItemSortField) ? (search.sortBy as TItemSortField) : undefined,
		sortDir: search.sortDir === 'asc' || search.sortDir === 'desc' ? search.sortDir : undefined,
	};
}

/** Whether any filter narrows the list (sorting alone does not). */
export function hasItemFilters(filters: TItemListFilters): boolean {
	return Boolean(
		filters.q ||
			filters.categoryId ||
			filters.status ||
			filters.minPrice !== undefined ||
			filters.maxPrice !== undefined ||
			filters.minStock !== undefined ||
			filters.maxStock !== undefined,
	);
}

/** How many of the popover's filters are active (the badge on its button). */
export function countPopoverFilters(filters: TItemListFilters): number {
	return [
		filters.categoryId,
		filters.status,
		filters.minPrice !== undefined || filters.maxPrice !== undefined ? 'price' : undefined,
		filters.minStock !== undefined || filters.maxStock !== undefined ? 'stock' : undefined,
		filters.sortBy || filters.sortDir ? 'sort' : undefined,
	].filter(Boolean).length;
}
