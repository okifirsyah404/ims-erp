/**
 * Pagination parameters for list endpoints.
 *
 * @remarks
 * `page` is 1-based; `limit` is capped by the server's maximum page size.
 */
export type TPaginationRequest = {
	/** 1-based page index */
	page: number;
	/** Maximum rows per page; the server caps this at its configured maximum */
	limit: number;
};

/**
 * Pagination envelope echoed back to the caller with computed totals.
 */
export type TPaginationMeta = TPaginationRequest & {
	/** Total number of matching rows across all pages (excluding soft-deleted) */
	total: number;
	/** Number of pages available, derived from {@link TPaginationRequest.page} size */
	totalPages: number;
};

/**
 * Standard paginated response shape for list endpoints.
 *
 * @typeParam T - The row type being paginated
 */
export type TPaginationResult<T> = {
	/** Pagination state and totals for this page */
	meta: TPaginationMeta;
	/** The rows for the requested page */
	data: T[];
};
