import { createFileRoute } from '@tanstack/react-router';

import { AdminOnly } from '@/components/inventory/admin-only';
import { WarehouseList } from '@/components/inventory/warehouse-list';

/** Search params for the warehouse list (URL-backed filters). */
type TWarehousesSearch = {
	page?: number;
	search?: string;
	includeArchived?: boolean;
};

/** `/inventory/warehouses` — the warehouse master. */
export const Route = createFileRoute('/_authed/inventory/warehouses/')({
	validateSearch: (search: Record<string, unknown>): TWarehousesSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
		search: typeof search.search === 'string' && search.search ? search.search : undefined,
		includeArchived:
			search.includeArchived === true || search.includeArchived === 'true'
				? true
				: undefined,
	}),
	component: WarehousesPage,
});

function WarehousesPage() {
	return (
		<AdminOnly>
			<WarehouseList />
		</AdminOnly>
	);
}
