import { createFileRoute } from '@tanstack/react-router';

import { AdjustmentList } from '@/components/inventory/adjustment-list';

/**
 * `/inventory/stock/adjustments` — the adjustment document list.
 *
 * @remarks
 * Gated server-side on `stock_adjustment:read`. The per-row actions the
 * component renders are only what each status allows; approve/reject/post are
 * separately gated server-side, so a caller without those grants gets a 403,
 * which the component surfaces rather than hiding the failure.
 */
export const Route = createFileRoute('/_authed/inventory/stock/adjustments/')({
	component: AdjustmentsPage,
});

function AdjustmentsPage() {
	return <AdjustmentList />;
}
