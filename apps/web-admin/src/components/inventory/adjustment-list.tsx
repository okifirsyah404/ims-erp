import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CellData, ColumnDef } from '@tanstack/react-table';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import type { TranslationKey } from '@ims-erp/locales';
import {
	adjustmentsQueryOptions,
	transitionAdjustment,
	type TAdjustmentStatus,
	type TStockAdjustment,
} from '@/lib/adjustment-api';
import { EmptyState, ErrorState } from '@/components/empty-state';
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
				header: t('common:action.edit'),
				meta: { align: 'right' },
				cell: ({ row }) => (
					<AdjustmentActions
						row={row.original}
						pending={transition.isPending}
						onAction={(action) =>
							transition.mutate({ id: row.original.id, action })
						}
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

			{isError ? (
				<ErrorState error={error} bordered />
			) : !isPending && rows.length === 0 ? (
				<EmptyState title={t('inventory:adjustments.empty')} bordered />
			) : (
				<DataTable
					columns={columns}
					data={rows}
					getRowId={(row) => row.id}
					loading={isPending}
					bordered
				/>
			)}
		</div>
	);
}

/** The actions a document's status allows. */
function AdjustmentActions({
	row,
	pending,
	onAction,
}: {
	row: TStockAdjustment;
	pending: boolean;
	onAction: (
		action: 'submit' | 'approve' | 'reject' | 'cancel' | 'post',
	) => void;
}) {
	const { t } = useTranslation(['inventory', 'common']);

	return (
		<div className='space-x-1'>
				{row.status === 'draft' ? (
					<>
						<Button
							size='sm'
							variant='ghost'
							disabled={pending}
							onClick={() => onAction('submit')}
						>
							{t('inventory:adjustmentActions.submit')}
						</Button>
						<Button
							size='sm'
							variant='ghost'
							disabled={pending}
							onClick={() => onAction('cancel')}
						>
							{t('inventory:adjustmentActions.cancel')}
						</Button>
					</>
				) : null}
				{row.status === 'submitted' ? (
					<>
						<Button
							size='sm'
							disabled={pending}
							onClick={() => onAction('approve')}
						>
							{t('inventory:adjustmentActions.approve')}
						</Button>
						<Button
							size='sm'
							variant='ghost'
							disabled={pending}
							onClick={() => onAction('reject')}
						>
							{t('inventory:adjustmentActions.reject')}
						</Button>
					</>
				) : null}
				{row.status === 'approved' ? (
					<Button
						size='sm'
						disabled={pending}
						onClick={() => onAction('post')}
					>
						{t('inventory:adjustmentActions.post')}
					</Button>
				) : null}
		</div>
	);
}
