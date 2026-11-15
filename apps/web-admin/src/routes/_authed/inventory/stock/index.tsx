import { createFileRoute } from '@tanstack/react-router';

import { StockList } from '@/components/inventory/stock-list';

/** Search params for the balance list (URL-backed pagination). */
type TStockSearch = {
	page?: number;
};

/**
 * `/inventory/stock` — on-hand balances per warehouse.
 *
 * @remarks
 * Not wrapped in `AdminOnly`: unlike the warehouse master, stock reads ride
 * `erpGuard` on `stock:read`, so an ordinary organization member with a stock
 * grant must be able to see them. Gating the page on the platform-admin role
 * would hide the screen from the people who use it.
 *
 * Only `page` lives in the URL; the page size is a frontend constant.
 */
export const Route = createFileRoute('/_authed/inventory/stock/')({
	validateSearch: (search: Record<string, unknown>): TStockSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
	}),
	component: StockPage,
});

function StockPage() {
	const { page } = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<StockList
			page={page ?? 1}
			onPageChange={(next) =>
				void navigate({ search: (prev) => ({ ...prev, page: next }) })
			}
		/>
	);
}
