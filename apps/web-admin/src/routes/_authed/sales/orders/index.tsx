import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

import { Badge } from '@ims-erp/ui/components/badge';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@ims-erp/ui/components/input-group';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatBusinessDate, formatIdr } from '@/lib/format';
import {
	SALES_ORDER_STATUS_VARIANT,
	SALES_ORDER_STATUSES,
	salesOrdersQueryOptions,
	type TSalesOrder,
	type TSalesOrderStatus,
} from '@/lib/sales-order-api';

const PAGE_SIZE = 20;

/** `/sales/orders` — sales orders visible to the caller (ADR-0011 step 3d). */
export const Route = createFileRoute('/_authed/sales/orders/')({
	component: SalesOrderListPage,
});

function SalesOrderListPage() {
	const { t, i18n } = useTranslation(['sales', 'common']);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<TSalesOrderStatus | ''>('');
	const deferredSearch = useDeferredValue(search.trim());
	const filtered = deferredSearch !== '' || status !== '';
	const { data, isPending, isError, error } = useQuery(
		salesOrdersQueryOptions({ page, limit: PAGE_SIZE, search: deferredSearch || undefined, status: status || undefined }),
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TSalesOrder, CellData>[]>(
		() => [
			{
				id: 'code',
				header: t('sales:order.code'),
				cell: ({ row }) => (
					<>
						<Link
							to='/sales/orders/$orderId'
							params={{ orderId: row.original.id }}
							className='font-medium hover:underline'
						>
							{row.original.code}
						</Link>
						<div className='text-xs text-muted-foreground'>
							{[row.original.quotationCode, row.original.customerPoNumber].filter(Boolean).join(' · ')}
						</div>
					</>
				),
			},
			{
				id: 'customer',
				header: t('sales:quotation.customer'),
				cell: ({ row }) => row.original.customerSnapshot.name,
			},
			{
				id: 'orderDate',
				header: t('sales:order.date'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => formatBusinessDate(row.original.orderDate, i18n.language),
			},
			{
				id: 'status',
				header: t('sales:quotation.status'),
				cell: ({ row }) => (
					<Badge variant={SALES_ORDER_STATUS_VARIANT[row.original.status]}>
						{t(`sales:orderStatus.${row.original.status}`)}
					</Badge>
				),
			},
			{
				id: 'grandTotal',
				header: t('sales:quotation.grandTotal'),
				meta: { align: 'right' },
				cell: ({ row }) => formatIdr(row.original.grandTotal),
			},
		],
		[t, i18n.language],
	);

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('sales:orders.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('sales:orders.description')}</p>
			</div>

			<div className='flex flex-wrap items-center gap-2'>
				<InputGroup className='max-w-sm'>
					<InputGroupAddon align='inline-start'>
						<Search aria-hidden='true' />
					</InputGroupAddon>
					<InputGroupInput
						type='search'
						aria-label={t('sales:orders.search')}
						placeholder={t('sales:orders.search')}
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
						setStatus(value === 'all' || value == null ? '' : (value as TSalesOrderStatus));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('sales:quotation.status')} className='w-44'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('sales:quotations.allStatuses')}</SelectItem>
						{SALES_ORDER_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`sales:orderStatus.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{isError ? (
				<ErrorState error={error} bordered />
			) : !isPending && data.rows.length === 0 ? (
				<EmptyState
					title={filtered ? t('sales:orders.noResults') : t('sales:orders.empty')}
					bordered
				/>
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
						<PaginationControls
							page={data.pagination.page}
							totalPages={data.pagination.totalPages}
							onPageChange={setPage}
						/>
					)}
				</>
			)}
		</div>
	);
}
