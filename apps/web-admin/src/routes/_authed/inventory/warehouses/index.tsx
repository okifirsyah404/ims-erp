import { createFileRoute } from '@tanstack/react-router';

import { AdminOnly } from '@/components/inventory/admin-only';
import { WarehouseList } from '@/components/inventory/warehouse-list';

/** Lifecycle filter values. `archived` replaces the old include-archived toggle. */
const STATUS_VALUES = ['all', 'active', 'inactive', 'archived'] as const;
type TWarehouseStatus = (typeof STATUS_VALUES)[number];

/** Sortable columns. */
const SORT_FIELDS = ['name', 'code', 'status'] as const;
type TWarehouseSortField = (typeof SORT_FIELDS)[number];

/** Search params for the warehouse list (URL-backed filters). */
type TWarehousesSearch = {
	page?: number;
	search?: string;
	status?: TWarehouseStatus;
	sortBy?: TWarehouseSortField;
	sortDir?: 'asc' | 'desc';
};

/** `/inventory/warehouses` — the warehouse master. */
export const Route = createFileRoute('/_authed/inventory/warehouses/')({
	validateSearch: (search: Record<string, unknown>): TWarehousesSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
		search: typeof search.search === 'string' && search.search ? search.search : undefined,
		status: STATUS_VALUES.includes(search.status as TWarehouseStatus)
			? (search.status as TWarehouseStatus)
			: undefined,
		sortBy: SORT_FIELDS.includes(search.sortBy as TWarehouseSortField)
			? (search.sortBy as TWarehouseSortField)
			: undefined,
		sortDir: search.sortDir === 'asc' || search.sortDir === 'desc' ? search.sortDir : undefined,
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
