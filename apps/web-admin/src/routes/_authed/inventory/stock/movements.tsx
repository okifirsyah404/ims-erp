import { createFileRoute } from '@tanstack/react-router';

import { MovementList } from '@/components/inventory/movement-list';

/**
 * `/inventory/stock/movements` — the append-only movement ledger.
 *
 * @remarks
 * Rides `stock:read` like the balance list, so no `AdminOnly` wrapper. The
 * Reverse action it offers is separately gated server-side on
 * `stock_adjustment:post`; a caller without that grant sees the button and gets
 * a 403, which the component surfaces.
 */
export const Route = createFileRoute('/_authed/inventory/stock/movements')({
	component: MovementsPage,
});

function MovementsPage() {
	return <MovementList />;
}
