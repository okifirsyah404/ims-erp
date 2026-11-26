import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CellData, ColumnDef } from '@tanstack/react-table';

import { Badge } from '@ims-erp/ui/components/badge';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import type { TranslationKey } from '@ims-erp/locales';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { ItemThumb } from '@/components/item-thumb';
import {
	movementsQueryOptions,
	OUTBOUND_MOVEMENT_TYPES,
	reverseMovement,
	type TStockMovement,
} from '@/lib/stock-api';
import { useClampPage } from '@/lib/use-clamp-page';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { ArrowLeftRight, Undo2 } from 'lucide-react';
import { RowActions } from '@/components/data-table/row-actions';
import { useConfirm } from '@/components/confirm-dialog';
import { usePermission } from '@/lib/use-permission';

/** Rows per page: 24 keeps a full-height page without endless scrolling. */
const PAGE_SIZE = 24;

/**
 * The movement ledger.
 *
 * @remarks
 * Read-only apart from reversal, because the ledger is **append-only**: a wrong
 * movement is corrected by appending an opposing one, never by editing. Two
 * consequences shape this screen:
 *
 * - Only a `posted` row offers Reverse. A `reversed` row already has its
 *   opposing pair, and the backend refuses a second reversal outright.
 * - Only an **inbound** type can be reversed safely in the common case —
 *   reversing an outbound movement adds stock back, while reversing an inbound
 *   one removes stock and may go negative. The backend refuses that, so the
 *   error is surfaced rather than pre-empted here with a stale balance.
 */
export function MovementList({
	page,
	onPageChange,
}: {
	/** Current page, owned by the route's `page` search param. */
	page: number;
	onPageChange: (page: number) => void;
}) {
	const { t } = useTranslation(['inventory', 'common']);
	// Reversing a movement is guarded by `stock_adjustment:post` on the backend.
	const canReverse = usePermission('stock_adjustment.post');
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const { data, isPending, isError, error } = useQuery({
		...movementsQueryOptions({ page, limit: PAGE_SIZE }),
		// Keeps the current page visible while the next one loads.
		placeholderData: (previous) => previous,
	});

	const reversal = useMutation({
		mutationFn: (movementId: string) => reverseMovement(movementId),
		onSuccess: () => {
			// The balance moved as a side effect of the reversal, so both lists
			// are stale — not just the ledger.
			void queryClient.invalidateQueries({ queryKey: ['stock'] });
		},
	});

	// A shrinking result set must not leave the ledger on a page that no longer
	// exists.
	const pagination = data?.pagination;
	useClampPage(page, pagination?.totalPages, onPageChange);
	const effectivePage = Math.min(page, pagination?.totalPages ?? page);

	const columns = useMemo<
		ColumnDef<DataTableFeatures, TStockMovement, CellData>[]
	>(
		() => [
			{
				accessorKey: 'code',
				header: t('inventory:movements.code'),
				meta: { cellClassName: 'font-mono text-xs' },
			},
			{
				id: 'type',
				header: t('inventory:movements.type'),
				cell: ({ row }) =>
					t(
						`inventory:movements.type.${row.original.movementType}` as TranslationKey,
						{ defaultValue: row.original.movementType },
					),
			},
			{
				id: 'item',
				header: t('inventory:movements.item'),
				cell: ({ row }) => (
					<div className='flex items-center gap-2'>
						<ItemThumb
							src={row.original.imageUrl}
							name={row.original.itemName ?? row.original.productId}
						/>
						<Link
							to='/products/$productId'
							params={{ productId: row.original.productId }}
							className='hover:underline'
						>
							{row.original.itemName ?? (
								<span className='font-mono text-xs text-muted-foreground'>
									{row.original.productId}
								</span>
							)}
						</Link>
					</div>
				),
			},
			{
				id: 'quantity',
				header: t('inventory:movements.quantity'),
				meta: { align: 'right', cellClassName: 'font-mono' },
				// Direction is a property of the type, not the (unsigned) quantity —
				// the same rule the backend's `isOutbound` applies.
				cell: ({ row }) => (
					<>
						{OUTBOUND_MOVEMENT_TYPES.has(row.original.movementType) ? '−' : '+'}
						{row.original.quantity}
					</>
				),
			},
			{
				id: 'status',
				header: t('inventory:movements.statusLabel'),
				cell: ({ row }) => (
					<Badge
						variant={row.original.status === 'reversed' ? 'outline' : 'secondary'}
					>
						{t(
							`inventory:movements.status.${row.original.status}` as TranslationKey,
							{ defaultValue: row.original.status },
						)}
					</Badge>
				),
			},
			{
				id: 'reference',
				header: t('inventory:movements.reference'),
				meta: { cellClassName: 'text-xs' },
				cell: ({ row }) =>
					row.original.referenceType === null ? (
						<span className='text-muted-foreground'>—</span>
					) : (
						<span className='font-mono'>
							{row.original.referenceType}
							{row.original.referenceId === null
								? ''
								: `:${row.original.referenceId}`}
						</span>
					),
			},
			{
				id: 'notes',
				header: t('inventory:movements.notes'),
				meta: { cellClassName: 'text-xs text-muted-foreground' },
				cell: ({ row }) => row.original.notes ?? '—',
			},
			{
				id: 'occurredAt',
				header: t('inventory:movements.occurredAt'),
				meta: { cellClassName: 'text-xs text-muted-foreground' },
				cell: ({ row }) => new Date(row.original.occurredAt).toLocaleString(),
			},
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('common:action.edit')}</span>,
				meta: { align: 'right' },
				// Only a posted row can be reversed: the backend refuses a second
				// reversal, so offering the button would be a guaranteed error.
				cell: ({ row }) => (
					<RowActions
						label={t('common:action.edit')}
						actions={[
							{
								key: 'reverse',
								label: t('inventory:movements.reverse'),
								icon: Undo2,
								hidden: row.original.status !== 'posted' || !canReverse,
								disabled: reversal.isPending,
								// Irreversible and refused if it would go negative, so the
								// consequence is stated before the request, not after.
								destructive: true,
								onSelect: async () => {
									if (
										await confirm({
											title: t('inventory:movements.reverseConfirm'),
											description: t('inventory:movements.reverseConfirmBody'),
											destructive: true,
										})
									) {
										reversal.mutate(row.original.id);
									}
								},
							},
						]}
					/>
				),
			},
		],
		[canReverse, confirm, reversal, t],
	);

	const rows = data?.rows ?? [];

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-2xl font-semibold'>{t('inventory:movements.title')}</h1>
				<p className='text-sm text-muted-foreground'>
					{t('inventory:movements.description')}
				</p>
			</div>

			{reversal.isError ? (
				<p className='text-sm text-destructive'>{reversal.error.message}</p>
			) : null}
			{reversal.isSuccess ? (
				<p className='text-sm text-muted-foreground'>
					{t('inventory:movements.reversed')}
				</p>
			) : null}

			<DataTableCard>
				{isError ? (
					<ErrorState error={error} />
				) : !isPending && rows.length === 0 ? (
					<EmptyState icon={ArrowLeftRight} title={t('inventory:movements.empty')} />
				) : (
					<DataTable
						columns={columns}
						data={rows}
						getRowId={(row) => row.id}
						loading={isPending}
					/>
				)}

				<PaginationControls
					page={effectivePage}
					totalPages={pagination?.totalPages ?? 1}
					onPageChange={onPageChange}
				/>
			</DataTableCard>
		</div>
	);
}


