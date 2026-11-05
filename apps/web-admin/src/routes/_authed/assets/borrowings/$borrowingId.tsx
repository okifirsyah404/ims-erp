import { createFileRoute } from '@tanstack/react-router';

import { BorrowingDetail } from '@/components/assets/borrowing-detail';

/**
 * `/assets/borrowings/$borrowingId` — one borrowing with its units and
 * timeline.
 *
 * @remarks
 * Gated server-side on `asset_borrowing:read`. The page renders whatever the server
 * chose to send, including the guest-PII redaction marker: a caller without
 * `asset_borrowing:mark_lost` receives the identity fields as `null` and the marker
 * explains why, rather than leaving what looks like missing data.
 */
export const Route = createFileRoute(
	'/_authed/assets/borrowings/$borrowingId',
)({
	component: BorrowingDetailPage,
});

function BorrowingDetailPage() {
	const { borrowingId } = Route.useParams();
	return <BorrowingDetail borrowingId={borrowingId} />;
}
