import { createFileRoute } from '@tanstack/react-router';

import { AdjustmentForm } from '@/components/inventory/adjustment-form';

/**
 * `/inventory/stock/adjust` — raise a stock adjustment.
 *
 * @remarks
 * Gated server-side on `stock_adjustment:create`; no `AdminOnly` wrapper, for
 * the same reason as the balance list. Creating a document moves no stock — it
 * lands in `draft` and must clear the approval chain first.
 */
export const Route = createFileRoute('/_authed/inventory/stock/adjust')({
	component: AdjustPage,
});

function AdjustPage() {
	return <AdjustmentForm />;
}
