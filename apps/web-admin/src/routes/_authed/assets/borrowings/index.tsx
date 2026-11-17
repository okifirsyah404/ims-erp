import { createFileRoute } from '@tanstack/react-router';

import { BorrowingList } from '@/components/assets/borrowing-list';

/** Search params for the borrowing list (URL-backed pagination). */
type TBorrowingsSearch = {
	page?: number;
};

/**
 * `/assets/borrowings` — the borrowing document list.
 *
 * @remarks
 * Gated server-side on `asset_borrowing:read`. The per-row actions the component
 * renders are only what each status allows; approve, issue, and close are
 * separately gated server-side, so a caller without those grants gets a 403,
 * which the component surfaces rather than hiding the failure.
 *
 * Only `page` lives in the URL; the page size is a frontend constant.
 */
export const Route = createFileRoute('/_authed/assets/borrowings/')({
	validateSearch: (search: Record<string, unknown>): TBorrowingsSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
	}),
	component: BorrowingsPage,
});

function BorrowingsPage() {
	const { page } = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<BorrowingList
			page={page ?? 1}
			onPageChange={(next) =>
				void navigate({ search: (prev) => ({ ...prev, page: next }) })
			}
		/>
	);
}
