import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/toast';

import { AdminOnly } from '@/components/inventory/admin-only';
import { WarehouseForm } from '@/components/inventory/warehouse-form';
import {
	createWarehouse,
	type TWarehouseCreateInput,
	type TWarehouseUpdateInput,
} from '@/lib/warehouse-api';

/** `/warehouses/new` — creates a warehouse, global by default. */
export const Route = createFileRoute('/_authed/warehouses/new')({
	component: NewWarehousePage,
});

function NewWarehousePage() {
	const { t } = useTranslation(['inventory', 'common', 'warehouse']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);

	async function handleSubmit(
		input: TWarehouseCreateInput | TWarehouseUpdateInput,
	) {
		setSubmitting(true);
		try {
			const created = await createWarehouse(input as TWarehouseCreateInput);
			toast.success(t('warehouse:warehouseForm.created'));
			await queryClient.invalidateQueries({ queryKey: ['warehouses'] });
			if (created) {
				void navigate({
					to: '/warehouses/$warehouseId',
					params: { warehouseId: created.id },
				});
			} else {
				void navigate({ to: '/warehouses' });
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<AdminOnly>
			<WarehouseForm
				submitting={submitting}
				onSubmit={(input) => void handleSubmit(input)}
				onCancel={() => void navigate({ to: '/warehouses' })}
			/>
		</AdminOnly>
	);
}
