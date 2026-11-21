import { createFileRoute } from '@tanstack/react-router';

import { AdjustmentForm } from '@/components/inventory/adjustment-form';

/** Optional prefill, set by the "Stock adjustment" entry of a product or warehouse card. */
type TAdjustSearch = {
	productId?: string;
	warehouseId?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (value: unknown) => (typeof value === 'string' && UUID.test(value) ? value : undefined);

/**
 * `/inventory/stock/adjust` - raise a stock adjustment.
 *
 * @remarks
 * Gated server-side on `stock_adjustment:create`; no `AdminOnly` wrapper, for
 * the same reason as the balance list. Creating a document moves no stock - it
 * lands in `draft` and must clear the approval chain first.
 */
export const Route = createFileRoute('/_authed/inventory/stock/adjust')({
	validateSearch: (search: Record<string, unknown>): TAdjustSearch => ({
		productId: uuid(search.productId),
		warehouseId: uuid(search.warehouseId),
	}),
	component: AdjustPage,
});

function AdjustPage() {
	const { productId, warehouseId } = Route.useSearch();
	return <AdjustmentForm initial={{ productId, warehouseId }} />;
}
