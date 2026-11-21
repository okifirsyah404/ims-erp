import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CellData, ColumnDef } from '@tanstack/react-table';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { itemDetailLink } from '@/lib/item-routes';
import { PackageOpen } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import {
	productsQueryOptions,
	type TProduct,
	type TProductKind,
} from '@/lib/inventory-api';

/** Rows per page in the detail tabs. */
const PAGE_SIZE = 10;

/**
 * Trims a decimal-string quantity (`numeric(18,3)` wire format) to at most
 * three fraction digits, dropping trailing zeros: `'2.000'` → `'2'`,
 * `'1.500'` → `'1.5'`.
 */
function formatQuantity(value: string): string {
	const number = Number(value);
	return Number.isFinite(number)
		? String(Math.round(number * 1000) / 1000)
		: value;
}

/**
 * Read-only item table for one kind, scoped to a warehouse.
 *
 * @remarks
 * Server-side pagination and search: page and search are component state
 * that flows into the query key, so each change is a fresh request, and
 * `placeholderData` keeps the previous page visible while the next loads.
 * `warehouseId` narrows to products with stock in the warehouse (backend EXISTS
 * filter over live serials or stock balances) and decorates each row with the
 * product's `quantity_on_hand` summed over `stocks` bins — the Quantity column
 * therefore covers serialized and quantity-tracked items alike.
 */
export function WarehouseItemTable({
	warehouseId,
	itemKind,
}: {
	warehouseId: string;
	itemKind: TProductKind;
}) {
	const { t } = useTranslation(['inventory', 'common', 'warehouse', 'product']);
	const [page, setPage] = useState(1);
	const [searchTerm, setSearchTerm] = useState('');
	const [submittedSearch, setSubmittedSearch] = useState('');

	const { data, isPending, isError, error } = useQuery({
		...productsQueryOptions({
			productKind: itemKind,
			warehouseId,
			search: submittedSearch || undefined,
			page,
			limit: PAGE_SIZE,
		}),
		placeholderData: (previous) => previous,
	});

	// Keep page in range when a filter shrinks the result set.
	const pagination = data?.pagination;
	const effectivePage = Math.min(page, pagination?.totalPages ?? page);

	const columns = useMemo<ColumnDef<DataTableFeatures, TProduct, CellData>[]>(
		() => [
			{
				id: 'image',
				header: t('warehouse:warehouses.image'),
				meta: { headClassName: 'w-16' },
				cell: ({ row }) =>
					row.original.imageUrl ? (
						<img
							src={row.original.imageUrl}
							alt={row.original.name}
							className='size-10 rounded object-cover'
							loading='lazy'
						/>
					) : (
						<div
							aria-hidden='true'
							className='flex size-10 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground'
						>
							{row.original.name.slice(0, 2).toUpperCase()}
						</div>
					),
			},
			{
				accessorKey: 'sku',
				header: t('product:items.sku'),
				meta: { cellClassName: 'font-mono text-xs' },
			},
			{ accessorKey: 'name', header: t('product:items.name') },
			{
				id: 'unitLabel',
				header: t('product:items.unitLabel'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => row.original.unitLabel ?? '—',
			},
			{
				id: 'quantity',
				header: t('warehouse:warehouses.quantity'),
				meta: { align: 'right', cellClassName: 'tabular-nums' },
				cell: ({ row }) =>
					row.original.quantityOnHand == null
						? '—'
						: formatQuantity(row.original.quantityOnHand),
			},
			{
				accessorKey: 'minStockQty',
				header: t('product:items.minStockQty'),
				meta: { cellClassName: 'tabular-nums' },
			},
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('common:action.edit')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<Button
						variant='ghost'
						size='sm'
						render={
							<Link {...itemDetailLink(row.original.productKind, row.original.id)} />
						}
					>
						{t('common:action.edit')}
					</Button>
				),
			},
		],
		[t],
	);

	if (isError) {
		return <ErrorState error={error} bordered />;
	}

	const rows = data?.rows ?? [];

	return (
		<Card>
			<CardContent className='flex flex-col gap-3'>
				<Input
					className='w-64'
					placeholder={t('warehouse:warehouses.searchPlaceholder')}
					value={searchTerm}
					onChange={(event) => setSearchTerm(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter') {
							setPage(1);
							setSubmittedSearch(searchTerm);
						}
					}}
				/>
				{rows.length === 0 && !isPending ? (
					<EmptyState
						icon={PackageOpen}
						title={t('product:items.emptyTitle')}
						description={t('product:items.empty')}
						className='py-4'
					/>
				) : (
					<DataTable
						columns={columns}
						data={rows}
						getRowId={(item) => item.id}
						loading={isPending}
					/>
				)}
				{pagination && (
					<PaginationControls
						page={effectivePage}
						totalPages={pagination.totalPages}
						onPageChange={setPage}
					/>
				)}
			</CardContent>
		</Card>
	);
}
