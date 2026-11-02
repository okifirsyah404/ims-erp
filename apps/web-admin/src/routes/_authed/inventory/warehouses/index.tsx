import { createFileRoute } from '@tanstack/react-router';

import { AdminOnly } from '@/components/inventory/admin-only';
import { WarehouseList } from '@/components/inventory/warehouse-list';

/** `/inventory/warehouses` — the warehouse master. */
export const Route = createFileRoute('/_authed/inventory/warehouses/')({
	component: WarehousesPage,
});

function WarehousesPage() {
	return (
		<AdminOnly>
			<WarehouseList />
		</AdminOnly>
	);
}
