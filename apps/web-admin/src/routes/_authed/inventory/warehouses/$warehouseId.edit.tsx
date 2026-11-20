import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';

import { WarehouseAccessGate } from '@/components/inventory/warehouse-access-gate';
import { WarehouseForm } from '@/components/inventory/warehouse-form';
import {
	updateWarehouse,
	type TWarehouseCreateInput,
	type TWarehouseUpdateInput,
	warehouseQueryOptions,
} from '@/lib/warehouse-api';

/** `/inventory/warehouses/$warehouseId/edit` — edits a warehouse. */
export const Route = createFileRoute(
	'/_authed/inventory/warehouses/$warehouseId/edit',
)({
	component: EditWarehousePage,
});

function EditWarehousePage() {
	const { t } = useTranslation(['inventory', 'common']);
	const { warehouseId } = useParams({ from: Route.id });
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);

	const { data: warehouse, isPending, isError, error: loadError } = useQuery(
		warehouseQueryOptions(warehouseId),
	);

	async function handleSubmit(
		input: TWarehouseCreateInput | TWarehouseUpdateInput,
	) {
		setSubmitting(true);
		try {
			await updateWarehouse(warehouseId, input as TWarehouseUpdateInput);
			toast.success(t('inventory:warehouseForm.updated'));
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ['warehouses'] }),
				queryClient.invalidateQueries({
					queryKey: warehouseQueryOptions(warehouseId).queryKey,
				}),
			]);
			void navigate({
				to: '/inventory/warehouses/$warehouseId',
				params: { warehouseId },
			});
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		} finally {
			setSubmitting(false);
		}
	}

	if (isPending) return <PageSkeleton cards={1} />;

	if (isError) return <ErrorState error={loadError} bordered />;

	if (!warehouse) {
		return (
			<WarehouseAccessGate>
				<EmptyState title={t('inventory:warehouses.notFound')} bordered />
			</WarehouseAccessGate>
		);
	}

	return (
		<WarehouseAccessGate>
			<WarehouseForm
				warehouse={warehouse}
				submitting={submitting}
				onSubmit={(input) => void handleSubmit(input)}
				onCancel={() =>
					void navigate({
						to: '/inventory/warehouses/$warehouseId',
						params: { warehouseId },
					})
				}
			/>
		</WarehouseAccessGate>
	);
}
