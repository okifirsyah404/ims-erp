/**
 * The single builder for repository pagination envelopes.
 *
 * @remarks
 * Every repository that answers "one filtered page" returns
 * `TPaginationResult<T>` from `@ims-erp/common`, and builds the `meta` block
 * here — never inline. Before this helper each repository hand-rolled its own
 * `totalPages`, and they had drifted apart (`Math.ceil(...)`,
 * `Math.ceil(...) || 1`, `Math.max(1, ...)`), so the same empty list could
 * report one page in one module and zero in another.
 *
 * Convention (pinned here so the next module cannot drift):
 *
 * - the page-returning repository method is named `paginate`, or
 *   `paginate<Thing>` when one repository serves several lists
 *   (`paginateMembers`, `paginateReceipts`, `paginateIncoming`);
 * - it takes **one** request object — `TPaginationRequest & { ...filters }` —
 *   never `(organizationId, filters, pagination)` positionally;
 * - `totalPages` is `Math.ceil(total / limit)`, so an empty result set
 *   reports `0` pages. Callers clamp (`useClampPage` in web-admin).
 */

import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';

/**
 * Builds the paginated envelope for one page of rows.
 *
 * @param request - The page settings the caller asked for; `page` and `limit`
 * are echoed back unchanged so the envelope is self-describing
 * @param total - Count of matching alive rows **before** the page was cut
 * @param data - The rows of the requested page
 * @returns The `{ meta, data }` contract consumed by `okPaginated()` in the
 * controller layer
 */
export function paginationResult<T>(
	request: TPaginationRequest,
	total: number,
	data: T[],
): TPaginationResult<T> {
	return {
		meta: {
			page: request.page,
			limit: request.limit,
			total,
			totalPages: Math.ceil(total / request.limit),
		},
		data,
	};
}
