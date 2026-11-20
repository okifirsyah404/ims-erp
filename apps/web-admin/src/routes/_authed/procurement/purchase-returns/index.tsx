import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@ims-erp/ui/components/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatBusinessDate, formatIdr } from '@/lib/format';
import {
	PURCHASE_RETURN_STATUSES,
	purchaseReturnsQueryOptions,
	RETURN_STATUS_VARIANT,
	type TPurchaseReturn,
	type TPurchaseReturnStatus,
} from '@/lib/purchase-return-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

/** `/procurement/purchase-returns` — goods sent back to suppliers (ERP-0068). */
export const Route = createFileRoute('/_authed/procurement/purchase-returns/')({
	component: PurchaseReturnListPage,
});

function PurchaseReturnListPage() {
	const { t, i18n } = useTranslation(['procurement', 'common']);
	const canCreate = usePermission('purchase_return.create');
	const canSeeCost = usePermission('product.read_cost');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<TPurchaseReturnStatus | ''>('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		purchaseReturnsQueryOptions({ page, limit: PAGE_SIZE, search: deferredSearch || undefined, status: status || undefined }),
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TPurchaseReturn, CellData>[]>(() => {
		const base: ColumnDef<DataTableFeatures, TPurchaseReturn, CellData>[] = [
			{
				id: 'code',
				header: t('procurement:return.code'),
				cell: ({ row }) => (
					<>
						<Link
							to='/procurement/purchase-returns/$purchaseReturnId'
							params={{ purchaseReturnId: row.original.id }}
							className='font-medium hover:underline'
						>
							{row.original.code ?? t('procurement:po.noNumber')}
						</Link>
						<div className='text-xs text-muted-foreground'>{row.original.reason}</div>
					</>
				),
			},
			{ accessorKey: 'goodsReceiptCode', header: t('procurement:receipt.code') },
			{ accessorKey: 'supplierName', header: t('procurement:po.supplier') },
			{
				id: 'returnDate',
				header: t('procurement:return.date'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => formatBusinessDate(row.original.returnDate, i18n.language),
			},
			{
				id: 'status',
				header: t('procurement:po.status'),
				cell: ({ row }) => (
					<Badge variant={RETURN_STATUS_VARIANT[row.original.status]}>
						{t(`procurement:returnStatus.${row.original.status}`)}
					</Badge>
				),
			},
		];
		if (!canSeeCost) return base;
		return [
			...base,
			{
				id: 'totalAmount',
				header: t('procurement:return.total'),
				meta: { align: 'right' },
				cell: ({ row }) => formatIdr(row.original.totalAmount),
			},
		];
	}, [t, i18n.language, canSeeCost]);

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('procurement:returns.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('procurement:returns.description')}</p>
				</div>
				{canCreate && (
					<Button render={<Link to='/procurement/purchase-returns/new' />} nativeButton={false}>
						{t('procurement:returns.new')}
					</Button>
				)}
			</div>
			<div className='flex flex-wrap items-center gap-3'>
				<InputGroup className='max-w-sm'>
					<InputGroupAddon align='inline-start'>
						<Search aria-hidden='true' />
					</InputGroupAddon>
					<InputGroupInput
						type='search'
						aria-label={t('procurement:returns.search')}
						placeholder={t('procurement:returns.search')}
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(1);
						}}
					/>
				</InputGroup>
				<Select
					value={status || 'all'}
					onValueChange={(value: string | null) => {
						setStatus(value === 'all' || value == null ? '' : (value as TPurchaseReturnStatus));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('procurement:po.status')} className='w-48'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('procurement:pos.allStatuses')}</SelectItem>
						{PURCHASE_RETURN_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`procurement:returnStatus.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			{isError ? (
				<ErrorState error={error} bordered />
			) : !isPending && data.rows.length === 0 ? (
				<EmptyState title={t('procurement:returns.empty')} bordered />
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
