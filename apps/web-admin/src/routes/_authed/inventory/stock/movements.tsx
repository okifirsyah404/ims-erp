import { createFileRoute } from '@tanstack/react-router';

import { MovementList } from '@/components/inventory/movement-list';

/** Search params for the movement ledger (URL-backed pagination). */
type TMovementsSearch = {
	page?: number;
};

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
	validateSearch: (search: Record<string, unknown>): TMovementsSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
	}),
	component: MovementsPage,
});

function MovementsPage() {
	const { page } = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<MovementList
			page={page ?? 1}
			onPageChange={(next) =>
				void navigate({ search: (prev) => ({ ...prev, page: next }) })
			}
		/>
	);
}
