import { useEffect } from 'react';

/**
 * Decides whether a URL-backed page must be rewritten.
 *
 * @param page - The page from the URL search param
 * @param totalPages - `pagination.totalPages` of the current response
 * @returns The page to rewrite to, or `null` when the page is in range
 * @remarks
 * `totalPages` is `0` for an empty result set, which is still one page.
 */
export function clampPage(
	page: number,
	totalPages: number | undefined,
): number | null {
	if (totalPages === undefined) return null;
	const last = Math.max(totalPages, 1);
	return page > last ? last : null;
}

/**
 * Keeps a URL-backed `page` inside the range the server actually returned.
 *
 * @param page - The page from the URL search param
 * @param totalPages - `pagination.totalPages` of the current response
 * @param onPageChange - Rewrites the URL to the last page that exists
 * @remarks
 * A bookmarked `?page=7` on a list that has since shrunk would otherwise render
 * a false "nothing here yet" empty state. The effect settles after one rewrite,
 * because the new page is inside the range.
 */
export function useClampPage(
	page: number,
	totalPages: number | undefined,
	onPageChange: (page: number) => void,
) {
	useEffect(() => {
		const next = clampPage(page, totalPages);
		if (next !== null) onPageChange(next);
	}, [page, totalPages, onPageChange]);
}
