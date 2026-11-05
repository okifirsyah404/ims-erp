import { createFileRoute } from '@tanstack/react-router';

import { BorrowingList } from '@/components/assets/borrowing-list';

/**
 * `/assets/borrowings` — the borrowing document list.
 *
 * @remarks
 * Gated server-side on `asset_borrowing:read`. The per-row actions the component
 * renders are only what each status allows; approve, issue, and close are
 * separately gated server-side, so a caller without those grants gets a 403,
 * which the component surfaces rather than hiding the failure.
 */
export const Route = createFileRoute('/_authed/assets/borrowings/')({
	component: BorrowingsPage,
});

function BorrowingsPage() {
	return <BorrowingList />;
}
