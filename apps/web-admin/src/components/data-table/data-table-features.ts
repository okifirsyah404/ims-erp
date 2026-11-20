import {
	columnFilteringFeature,
	columnVisibilityFeature,
	filterFn_includesString,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	sortFn_alphanumeric,
	sortFn_text,
	tableFeatures,
} from '@tanstack/react-table';

/**
 * Extra per-column options every table shares.
 *
 * @remarks
 * Declared through TanStack v9's `columnMeta` slot so `columnDef.meta` is typed
 * everywhere without module augmentation.
 */
export type TColumnMeta = {
	/** Align both the header and the cells of this column. */
	align?: 'left' | 'right' | 'center';
	/** Classes applied to every cell in this column. */
	cellClassName?: string;
	/** Classes applied to the header cell of this column. */
	headClassName?: string;
	/** Size classes of this column's loading placeholder (default `h-4 w-full`). */
	skeletonClassName?: string;
};

/**
 * Table features registered across `web-admin`.
 *
 * @remarks
 * TanStack Table v9 is feature-based: anything not listed here is tree-shaken
 * out. Lists are still filtered, sorted and paginated **server-side** (see
 * `PaginationControls` and the `page`/`limit`/`search` query params), so the
 * client row models below only matter for tables that narrow what they already
 * hold in memory. One shared object keeps every table on the same feature set.
 */
export const features = tableFeatures({
	columnMeta: {} as TColumnMeta,
	columnFilteringFeature,
	columnVisibilityFeature,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	filteredRowModel: createFilteredRowModel(),
	paginatedRowModel: createPaginatedRowModel(),
	sortedRowModel: createSortedRowModel(),
	filterFns: { includesString: filterFn_includesString },
	sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
});

/** Pass as the first generic to every `ColumnDef` / `Column` / `Row` type. */
export type DataTableFeatures = typeof features;
