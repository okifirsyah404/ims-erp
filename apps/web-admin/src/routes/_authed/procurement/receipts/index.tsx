import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PackageCheck, Search } from 'lucide-react';

import { Button } from '@ims-erp/ui/components/button';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@ims-erp/ui/components/input-group';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatBusinessDate } from '@/lib/format';
import { goodsReceiptsQueryOptions, type TGoodsReceipt } from '@/lib/goods-receipt-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

/** `/procurement/receipts` — goods receipts (ADR-0011 step 4b). */
export const Route = createFileRoute('/_authed/procurement/receipts/')({
	component: GoodsReceiptListPage,
});

function GoodsReceiptListPage() {
	const { t, i18n } = useTranslation(['procurement', 'common']);
	const canReceive = usePermission('stock.receive');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		goodsReceiptsQueryOptions({ page, limit: PAGE_SIZE, search: deferredSearch || undefined }),
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TGoodsReceipt, CellData>[]>(
		() => [
			{
				id: 'code',
				header: t('procurement:receipt.code'),
				cell: ({ row }) => (
					<Link
						to='/procurement/receipts/$receiptId'
						params={{ receiptId: row.original.id }}
						className='font-medium hover:underline'
					>
						{row.original.code}
					</Link>
				),
			},
			{
				id: 'purchaseOrderCode',
				header: t('procurement:po.code'),
				cell: ({ row }) => row.original.purchaseOrderCode ?? '—',
			},
			{ accessorKey: 'supplierName', header: t('procurement:po.supplier') },
			{
				id: 'receiptDate',
				header: t('procurement:receipt.date'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => formatBusinessDate(row.original.receiptDate, i18n.language),
			},
			{
				id: 'supplierDeliveryRef',
				header: t('procurement:receipt.supplierDeliveryRef'),
				cell: ({ row }) => row.original.supplierDeliveryRef ?? '—',
			},
		],
		[t, i18n.language],
	);

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('procurement:receipts.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('procurement:receipts.description')}</p>
				</div>
				{canReceive && (
					<Button render={<Link to='/procurement/receipts/new' />} nativeButton={false}>
						{t('procurement:receipts.new')}
					</Button>
				)}
			</div>
			<InputGroup className='max-w-sm'>
				<InputGroupAddon align='inline-start'>
					<Search aria-hidden='true' />
				</InputGroupAddon>
				<InputGroupInput
					type='search'
					aria-label={t('procurement:receipts.search')}
					placeholder={t('procurement:receipts.search')}
					value={search}
					onChange={(e) => {
						setSearch(e.target.value);
						setPage(1);
					}}
				/>
			</InputGroup>
			{isError ? (
				<ErrorState error={error} bordered />
			) : !isPending && data.rows.length === 0 ? (
				<EmptyState icon={PackageCheck} title={t('procurement:receipts.empty')} bordered />
			) : (
				<>
					<DataTable
						columns={columns}
						data={data?.rows ?? []}
						getRowId={(row) => row.id}
						loading={isPending}
						bordered
					/>
					{data && data.pagination.totalPages > 1 && (
						<PaginationControls page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
					)}
				</>
			)}
		</div>
	);
}
