import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CellData, ColumnDef } from '@tanstack/react-table';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { Field, FieldLabel } from '@ims-erp/ui/components/field';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { useConfirm } from '@/components/confirm-dialog';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { ItemThumb } from '@/components/item-thumb';
import { balancesQueryOptions, recomputeBalances, type TStockBalance } from '@/lib/stock-api';
import { useClampPage } from '@/lib/use-clamp-page';
import { usePermission } from '@/lib/use-permission';

/** Rows per page: 24 keeps a full-height page without endless scrolling. */
const PAGE_SIZE = 24;

/**
 * The stock balance list: what is on hand, per warehouse.
 *
 * @remarks
 * A balance row's `organizationId` follows the **warehouse**, not the viewer
 * (data-model "scope rule"), so `organizationId === null` means the row belongs
 * to a global warehouse and is **shared** by every organization — not
 * "unowned". The badge says "Shared" for that reason; showing a blank scope
 * would read as missing data.
 *
 * `quantityAvailable` is displayed rather than derived: the column is a real
 * Postgres `CHECK` (`available = on_hand - reserved`), so the UI must not
 * recompute it and risk disagreeing.
 */
export function StockList({
	page,
	onPageChange,
}: {
	/** Current page, owned by the route's `page` search param. */
	page: number;
	onPageChange: (page: number) => void;
}) {
	const { t } = useTranslation(['inventory', 'common', 'warehouse']);
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const canSeeCost = usePermission('product.read_cost');
	const [inStockOnly, setInStockOnly] = useState(false);
	const { data, isPending, isError, error } = useQuery({
		...balancesQueryOptions({ page, limit: PAGE_SIZE, inStockOnly }),
		// Keeps the current page visible while the next one loads.
		placeholderData: (previous) => previous,
	});

	const recompute = useMutation({
		mutationFn: () => recomputeBalances(),
		onSuccess: () => {
			// Rebuilding rewrites every balance row, so the list is stale.
			void queryClient.invalidateQueries({ queryKey: ['stock'] });
		},
	});

	// A filter or a shrinking result set must not leave the list on a page that
	// no longer exists.
	const pagination = data?.pagination;
	useClampPage(page, pagination?.totalPages, onPageChange);
	const effectivePage = Math.min(page, pagination?.totalPages ?? page);

	const columns = useMemo<ColumnDef<DataTableFeatures, TStockBalance, CellData>[]>(
		() => [
			{
				id: 'item',
				header: t('inventory:stock.item'),
				cell: ({ row }) => (
					<div className='flex items-center gap-2'>
						<ItemThumb
							src={row.original.imageUrl}
							name={row.original.itemName ?? row.original.productId}
						/>
						<Link
							to='/inventory/items/$itemId'
							params={{ itemId: row.original.productId }}
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
				id: 'warehouse',
				header: t('inventory:stock.warehouse'),
				cell: ({ row }) => (
					<Link
						to='/warehouses/$warehouseId'
						params={{ warehouseId: row.original.warehouseId }}
						className='hover:underline'
					>
						{row.original.warehouseName ?? (
							<span className='font-mono text-xs text-muted-foreground'>
								{row.original.warehouseId}
							</span>
						)}
					</Link>
				),
			},
			{
				id: 'bin',
				header: t('inventory:stock.bin'),
				cell: ({ row }) =>
					row.original.binId === null ? (
						<span className='text-muted-foreground'>
							{t('inventory:stock.noBin')}
						</span>
					) : (
						<span className='font-mono text-xs'>{row.original.binId}</span>
					),
			},
			{
				id: 'scope',
				header: t('inventory:stock.scope'),
				cell: ({ row }) =>
					row.original.organizationId === null ? (
						<Badge variant='secondary'>{t('inventory:stock.shared')}</Badge>
					) : (
						<Badge variant='outline'>
							{t('warehouse:warehouses.organization')}
						</Badge>
					),
			},
			{
				accessorKey: 'quantityOnHand',
				header: t('inventory:stock.onHand'),
				meta: { align: 'right', cellClassName: 'font-mono' },
			},
			{
				accessorKey: 'quantityReserved',
				header: t('inventory:stock.reserved'),
				meta: {
					align: 'right',
					cellClassName: 'font-mono text-muted-foreground',
				},
			},
			{
				accessorKey: 'quantityAvailable',
				header: t('inventory:stock.available'),
				meta: { align: 'right', cellClassName: 'font-mono font-medium' },
			},
			{
				id: 'lastMovement',
				header: t('inventory:stock.lastMovement'),
				meta: { cellClassName: 'text-xs text-muted-foreground' },
				cell: ({ row }) =>
					row.original.lastMovementAt === null
						? '—'
						: new Date(row.original.lastMovementAt).toLocaleString(),
			},
		],
		[t],
	);

	const rows = data?.rows ?? [];

	return (
		<div className='space-y-4'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-semibold'>{t('inventory:stock.title')}</h1>
					<p className='text-sm text-muted-foreground'>
						{t('inventory:stock.description')}
					</p>
				</div>
				<div className='flex shrink-0 items-center gap-2'>
					<Field orientation='horizontal' className='w-auto'>
						<Checkbox
							id='stock-in-stock-only'
							checked={inStockOnly}
							onCheckedChange={(checked) => {
								setInStockOnly(checked === true);
								// The filter changes the result set, so page 1 is the
								// only page that is guaranteed to exist.
								onPageChange(1);
							}}
						/>
						<FieldLabel htmlFor='stock-in-stock-only'>
							{t('inventory:stock.inStockOnly')}
						</FieldLabel>
					</Field>
					{canSeeCost && (
						<Button
							variant='outline'
							render={<Link to='/inventory/stock/value' />}
						>
							{t('inventory:value.link')}
						</Button>
					)}
					<Button
						variant='outline'
						render={<Link to='/inventory/stock/movements' />}
					>
						{t('inventory:stock.movements')}
					</Button>
					<Button render={<Link to='/inventory/stock/adjust' />}>
						{t('inventory:stock.adjust')}
					</Button>
				</div>
			</div>

			{/* A repair tool, not a routine call: the running balance is already
			    correct, so this is offered but not advertised. */}
			<div className='flex items-center gap-3'>
				<Button
					variant='ghost'
					size='sm'
					disabled={recompute.isPending}
					onClick={async () => {
						if (
							await confirm({
								title: t('inventory:stock.recomputeConfirm'),
								description: t('inventory:stock.recomputeConfirmBody'),
								destructive: true,
							})
						) {
							recompute.mutate(undefined);
						}
					}}
				>
					{t('inventory:stock.recompute')}
				</Button>
				{recompute.isSuccess && recompute.data ? (
					<span className='text-xs text-muted-foreground'>
						{t('inventory:stock.recomputed', {
							written: recompute.data.written,
							removed: recompute.data.removed,
						})}
					</span>
				) : null}
				{recompute.isError ? (
					<span className='text-xs text-destructive'>
						{recompute.error.message}
					</span>
				) : null}
			</div>

			{isError ? (
				<ErrorState error={error} bordered />
			) : !isPending && rows.length === 0 ? (
				<EmptyState
					title={t('inventory:stock.empty')}
					bordered
				/>
			) : (
				<DataTable
					columns={columns}
					data={rows}
					getRowId={(row) => row.id}
					loading={isPending}
					bordered
				/>
			)}

			<PaginationControls
				page={effectivePage}
				totalPages={pagination?.totalPages ?? 1}
				onPageChange={onPageChange}
			/>
		</div>
	);
}
