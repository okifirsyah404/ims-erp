import {
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Pause, Play, Plus, Scale, Trash2 } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import { TaxTypeDialog } from './tax-type-dialog';
import { RowActions } from '@/components/data-table/row-actions';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { useConfirm } from '@/components/confirm-dialog';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	deleteTaxType,
	taxTypesQueryOptions,
	updateTaxType,
	type TTaxType,
} from '@/lib/tax-api';
import { usePermission } from '@/lib/use-permission';

/** The route API for `/finance/tax/types` (validated search params). */

const PAGE_SIZE = 20;

/**
 * Tax types & rates (ERP-0016): effective-dated rate rows with soft delete.
 * Overlap rejection happens server-side; the error surfaces as a toast.
 */
export function TaxTypeList() {
	const { t } = useTranslation(['tax', 'common']);
	const queryClient = useQueryClient();
	const canUpdate = usePermission('tax.update');
	const confirm = useConfirm();

	const [creating, setCreating] = useState(false);

	const [page, setPage] = useState(1);
	const { data, isPending, isError, error } = useQuery({
		...taxTypesQueryOptions({ page, limit: PAGE_SIZE }),
		placeholderData: (previous) => previous,
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ['tax-types'] });

	const toggleActive = useMutation({
		mutationFn: (row: { id: string; isActive: boolean }) =>
			updateTaxType(row.id, { isActive: !row.isActive }),
		onSuccess: async () => {
			toast.success(t('tax:types.updated'));
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const remove = useMutation({
		mutationFn: (id: string) => deleteTaxType(id),
		onSuccess: async () => {
			toast.success(t('tax:types.deleted'));
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const columns = useMemo<ColumnDef<DataTableFeatures, TTaxType, CellData>[]>(() => {
		const base: ColumnDef<DataTableFeatures, TTaxType, CellData>[] = [
			{
				accessorKey: 'code',
				header: t('tax:types.code'),
				meta: { cellClassName: 'font-mono text-xs' },
			},
			{ accessorKey: 'name', header: t('tax:types.name') },
			{
				accessorKey: 'rate',
				header: t('tax:types.rate'),
				meta: { cellClassName: 'font-mono text-xs' },
			},
			{
				accessorKey: 'effectiveFrom',
				header: t('tax:types.effectiveFrom'),
				meta: { cellClassName: 'text-xs' },
			},
			{
				accessorKey: 'effectiveTo',
				header: t('tax:types.effectiveTo'),
				meta: { cellClassName: 'text-xs' },
				cell: ({ row }) => row.original.effectiveTo ?? '—',
			},
			{
				accessorKey: 'isActive',
				header: t('tax:types.active'),
				cell: ({ row }) =>
					row.original.isActive ? (
						<Badge>{t('tax:types.active')}</Badge>
					) : (
						<Badge variant='outline'>{t('tax:types.inactive')}</Badge>
					),
			},
		];
		if (!canUpdate) return base;
		return [
			...base,
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('common:action.delete')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('common:action.delete')}
						actions={[
							{
								key: 'toggleActive',
								label: row.original.isActive
									? t('tax:types.inactive')
									: t('tax:types.active'),
								icon: row.original.isActive ? Pause : Play,
								onSelect: () => void toggleActive.mutateAsync(row.original),
							},
							{
								key: 'delete',
								label: t('common:action.delete'),
								icon: Trash2,
								destructive: true,
								onSelect: async () => {
									if (
										await confirm({
											title: t('tax:types.deleteConfirm'),
											destructive: true,
										})
									) {
										void remove.mutateAsync(row.original.id);
									}
								},
							},
						]}
					/>
				),
			},
		];
	}, [canUpdate, confirm, remove, t, toggleActive]);

	if (isError) {
		return <ErrorState error={error} bordered />;
	}

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-xl font-semibold'>{t('tax:types.title')}</h1>
				<p className='text-sm text-muted-foreground'>
					{t('tax:types.description')}
				</p>
			</div>

			<DataTableCard
				title={t('tax:types.title')}
				action={
					canUpdate ? (
						<Button size='sm' onClick={() => setCreating(true)}>
							<Plus className='size-4' data-icon='inline-start' />
							{t('tax:types.create')}
						</Button>
					) : null
				}
			>
				{!isPending && (!data || data.rows.length === 0) ? (
					<EmptyState
						icon={Scale}
						title={t('tax:types.title')}
						description={t('tax:types.empty')}
					/>
				) : (
					<DataTable
						columns={columns}
						data={data?.rows ?? []}
						loading={isPending}
						getRowId={(row) => row.id}
					/>
				)}

				<PaginationControls
					page={page}
					totalPages={data?.pagination.totalPages ?? 1}
					onPageChange={setPage}
				/>
			</DataTableCard>
			{creating ? <TaxTypeDialog onClose={() => setCreating(false)} /> : null}
		</div>
	);
}
