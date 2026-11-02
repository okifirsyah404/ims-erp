import { createFileRoute } from '@tanstack/react-router';

import { StockList } from '@/components/inventory/stock-list';

/**
 * `/inventory/stock` — on-hand balances per warehouse.
 *
 * @remarks
 * Not wrapped in `AdminOnly`: unlike the warehouse master, stock reads ride
 * `erpGuard` on `stock:read`, so an ordinary organization member with a stock
 * grant must be able to see them. Gating the page on the platform-admin role
 * would hide the screen from the people who use it.
 */
export const Route = createFileRoute('/_authed/inventory/stock/')({
	component: StockPage,
});

function StockPage() {
	return <StockList />;
}
