import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CellData, ColumnDef } from '@tanstack/react-table';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import type { TranslationKey } from '@ims-erp/locales';
import {
	adjustmentsQueryOptions,
	transitionAdjustment,
	type TAdjustmentStatus,
	type TStockAdjustment,
} from '@/lib/adjustment-api';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { Ban, Check, ClipboardList, Play, Send, X } from 'lucide-react';
import { RowActions } from '@/components/data-table/row-actions';
import { toast } from '@/components/toast';

/** Badge emphasis per status: only `posted` actually moved stock. */
const STATUS_VARIANT: Record<
	TAdjustmentStatus,
	'default' | 'secondary' | 'outline'
> = {
	draft: 'outline',
	submitted: 'secondary',
	approved: 'secondary',
	rejected: 'outline',
	posted: 'default',
	cancelled: 'outline',
};

/**
 * The adjustment document list, with the workflow actions available per status.
 *
 * @remarks
 * The buttons offered here mirror the backend state machine
 * (`draft → submitted → approved|rejected → posted|cancelled`); the machine is
 * still authoritative, so an illegal edge is refused server-side no matter what
 * this table renders. Rendering only legal actions keeps the common path from
 * producing a predictable 422.
 */
export function AdjustmentList() {
	const { t } = useTranslation(['inventory', 'common']);
	const queryClient = useQueryClient();
	const { data, isPending, isError, error } = useQuery(
		adjustmentsQueryOptions({ limit: 100 }),
	);

	const transition = useMutation({
		mutationFn: ({
			id,
			action,
		}: {
			id: string;
			action: 'submit' | 'approve' | 'reject' | 'cancel' | 'post';
		}) => transitionAdjustment(id, action),
		onSuccess: (_data, { action }) => {
			// Confirm which edge of the state machine actually ran: the row's new
			// badge shows the result, but the action that produced it is not
			// obvious when several rows are in flight. Each key is spelled out
			// here (not looked up) so the compiler and the dead-key scan see it.
			switch (action) {
				case 'submit':
					toast.success(t('inventory:adjustmentActions.submitted'));
					break;
				case 'approve':
					toast.success(t('inventory:adjustmentActions.approved'));
					break;
				case 'reject':
					toast.success(t('inventory:adjustmentActions.rejected'));
					break;
				case 'cancel':
					toast.success(t('inventory:adjustmentActions.cancelled'));
					break;
				case 'post':
					toast.success(t('inventory:adjustmentActions.posted'));
					break;
			}
			// Posting writes ledger rows and moves balances, so every stock query
			// is stale — not just this list.
			void queryClient.invalidateQueries({ queryKey: ['stock'] });
		},
		onError: (mutationError) => {
			toast.error(mutationError.message);
		},
	});

	const columns = useMemo<
		ColumnDef<DataTableFeatures, TStockAdjustment, CellData>[]
	>(
		() => [
			{
				accessorKey: 'code',
				header: t('inventory:adjustments.code'),
				meta: { cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => (
					<Link
						to='/inventory/stock/adjustments/$adjustmentId'
						params={{ adjustmentId: row.original.id }}
						className='hover:underline'
					>
						{row.original.code}
					</Link>
				),
			},
			{
				id: 'type',
				header: t('inventory:adjustments.type'),
				cell: ({ row }) =>
					t(
						`inventory:adjustments.type.${row.original.adjustmentType}` as TranslationKey,
						{ defaultValue: row.original.adjustmentType },
					),
			},
			{
				id: 'status',
				header: t('inventory:adjustments.statusLabel'),
				cell: ({ row }) => (
					<Badge variant={STATUS_VARIANT[row.original.status]}>
						{t(
							`inventory:adjustments.status.${row.original.status}` as TranslationKey,
							{ defaultValue: row.original.status },
						)}
					</Badge>
				),
			},
			{
				id: 'requestedBy',
				header: t('inventory:adjustments.requestedBy'),
				meta: { cellClassName: 'font-mono text-xs text-muted-foreground' },
				cell: ({ row }) => row.original.requestedBy ?? '—',
			},
			{
				id: 'requestedAt',
				header: t('inventory:adjustments.requestedAt'),
				meta: { cellClassName: 'text-xs text-muted-foreground' },
				cell: ({ row }) => new Date(row.original.requestedAt).toLocaleString(),
			},
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('common:action.edit')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('common:action.edit')}
						actions={[
							{
								key: 'submit',
								label: t('inventory:adjustmentActions.submit'),
								icon: Send,
								hidden: row.original.status !== 'draft',
								disabled: transition.isPending,
								onSelect: () =>
									transition.mutate({ id: row.original.id, action: 'submit' }),
							},
							{
								key: 'cancel',
								label: t('inventory:adjustmentActions.cancel'),
								icon: Ban,
								hidden: row.original.status !== 'draft',
								disabled: transition.isPending,
								onSelect: () =>
									transition.mutate({ id: row.original.id, action: 'cancel' }),
							},
							{
								key: 'approve',
								label: t('inventory:adjustmentActions.approve'),
								icon: Check,
								hidden: row.original.status !== 'submitted',
								disabled: transition.isPending,
								onSelect: () =>
									transition.mutate({ id: row.original.id, action: 'approve' }),
							},
							{
								key: 'reject',
								label: t('inventory:adjustmentActions.reject'),
								icon: X,
								hidden: row.original.status !== 'submitted',
								disabled: transition.isPending,
								onSelect: () =>
									transition.mutate({ id: row.original.id, action: 'reject' }),
							},
							{
								key: 'post',
								label: t('inventory:adjustmentActions.post'),
								icon: Play,
								hidden: row.original.status !== 'approved',
								disabled: transition.isPending,
								onSelect: () =>
									transition.mutate({ id: row.original.id, action: 'post' }),
							},
						]}
					/>
				),
			},
		],
		[t, transition],
	);

	const rows = data?.rows ?? [];

	return (
		<div className='space-y-4'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-semibold'>
						{t('inventory:adjustments.title')}
					</h1>
					<p className='text-sm text-muted-foreground'>
						{t('inventory:adjustments.description')}
					</p>
				</div>
				<Button
					render={<Link to='/inventory/stock/adjust' />}
					className='shrink-0'
				>
					{t('inventory:adjustments.new')}
				</Button>
			</div>

			{transition.isError ? (
				<p className='text-sm text-destructive'>{transition.error.message}</p>
			) : null}

			<DataTableCard>
				{isError ? (
					<ErrorState error={error} />
				) : !isPending && rows.length === 0 ? (
					<EmptyState icon={ClipboardList} title={t('inventory:adjustments.empty')} />
				) : (
					<DataTable
						columns={columns}
						data={rows}
						getRowId={(row) => row.id}
						loading={isPending}
						sortable
					/>
				)}
			</DataTableCard>
		</div>
	);
}


