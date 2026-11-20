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
	SALES_RETURN_STATUSES,
	salesReturnsQueryOptions,
	SALES_RETURN_STATUS_VARIANT,
	type TSalesReturn,
	type TSalesReturnStatus,
} from '@/lib/sales-return-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

/** `/sales/returns` — goods sent back to suppliers (ERP-0065). */
export const Route = createFileRoute('/_authed/sales/returns/')({
	component: SalesReturnListPage,
});

function SalesReturnListPage() {
	const { t, i18n } = useTranslation(['sales', 'common']);
	const canCreate = usePermission('purchase_return.create');
	const canSeeCost = usePermission('product.read_cost');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<TSalesReturnStatus | ''>('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		salesReturnsQueryOptions({ page, limit: PAGE_SIZE, search: deferredSearch || undefined, status: status || undefined }),
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TSalesReturn, CellData>[]>(() => {
		const base: ColumnDef<DataTableFeatures, TSalesReturn, CellData>[] = [
			{
				id: 'code',
				header: t('sales:return.code'),
				cell: ({ row }) => (
					<>
						<Link
							to='/sales/returns/$salesReturnId'
							params={{ salesReturnId: row.original.id }}
							className='font-medium hover:underline'
						>
							{row.original.code ?? t('sales:return.noNumber')}
						</Link>
						<div className='text-xs text-muted-foreground'>{row.original.reason}</div>
					</>
				),
			},
			{ accessorKey: 'deliveryNoteCode', header: t('sales:delivery.code') },
			{ accessorKey: 'customerName', header: t('sales:return.customer') },
			{
				id: 'returnDate',
				header: t('sales:return.date'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => formatBusinessDate(row.original.returnDate, i18n.language),
			},
			{
				id: 'status',
				header: t('sales:return.status'),
				cell: ({ row }) => (
					<Badge variant={SALES_RETURN_STATUS_VARIANT[row.original.status]}>
						{t(`sales:returnStatus.${row.original.status}`)}
					</Badge>
				),
			},
		];
		if (!canSeeCost) return base;
		return [
			...base,
			{
				id: 'totalAmount',
				header: t('sales:return.total'),
				meta: { align: 'right' },
				cell: ({ row }) => formatIdr(row.original.totalAmount),
			},
		];
	}, [t, i18n.language, canSeeCost]);

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('sales:returns.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('sales:returns.description')}</p>
				</div>
				{canCreate && (
					<Button render={<Link to='/sales/returns/new' />} nativeButton={false}>
						{t('sales:returns.new')}
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
						aria-label={t('sales:returns.search')}
						placeholder={t('sales:returns.search')}
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
						setStatus(value === 'all' || value == null ? '' : (value as TSalesReturnStatus));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('sales:return.status')} className='w-48'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('sales:returns.allStatuses')}</SelectItem>
						{SALES_RETURN_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`sales:returnStatus.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			{isError ? (
				<ErrorState error={error} bordered />
			) : !isPending && data.rows.length === 0 ? (
				<EmptyState title={t('sales:returns.empty')} bordered />
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
