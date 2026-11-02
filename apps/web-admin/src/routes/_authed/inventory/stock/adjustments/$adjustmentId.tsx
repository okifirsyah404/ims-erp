import { createFileRoute, useParams } from '@tanstack/react-router';

import { AdjustmentDetail } from '@/components/inventory/adjustment-detail';

/**
 * `/inventory/stock/adjustments/$adjustmentId` — one document with its lines.
 *
 * @remarks
 * The id is a path param, never a scope: the backend confines the lookup to the
 * caller's organization and answers 404 — not 403 — for another tenant's
 * document, so the caller cannot learn that the id exists.
 */
export const Route = createFileRoute(
	'/_authed/inventory/stock/adjustments/$adjustmentId',
)({
	component: AdjustmentDetailPage,
});

function AdjustmentDetailPage() {
	const { adjustmentId } = useParams({ from: Route.id });
	return <AdjustmentDetail adjustmentId={adjustmentId} />;
}
