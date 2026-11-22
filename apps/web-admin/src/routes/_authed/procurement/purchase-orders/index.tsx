import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Search } from 'lucide-react';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
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
	PO_STATUS_VARIANT,
	PURCHASE_ORDER_STATUSES,
	purchaseOrdersQueryOptions,
	type TPurchaseOrder,
	type TPurchaseOrderStatus,
} from '@/lib/procurement-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

/** `/procurement/purchase-orders` — purchase orders (ADR-0011 step 4a). */
export const Route = createFileRoute('/_authed/procurement/purchase-orders/')({
	component: PurchaseOrderListPage,
});

function PurchaseOrderListPage() {
	const { t, i18n } = useTranslation(['procurement', 'common']);
	const canCreate = usePermission('purchase_order.create');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<TPurchaseOrderStatus | ''>('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		purchaseOrdersQueryOptions({ page, limit: PAGE_SIZE, search: deferredSearch || undefined, status: status || undefined }),
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TPurchaseOrder, CellData>[]>(
		() => [
			{
				id: 'code',
				header: t('procurement:po.code'),
				cell: ({ row }) => (
					<>
						<Link
							to='/procurement/purchase-orders/$purchaseOrderId'
							params={{ purchaseOrderId: row.original.id }}
							className='font-medium hover:underline'
						>
							{row.original.code ?? t('procurement:po.noNumber')}
						</Link>
						<div className='text-xs text-muted-foreground'>{row.original.subject}</div>
					</>
				),
			},
			{
				id: 'supplier',
				header: t('procurement:po.supplier'),
				cell: ({ row }) => row.original.supplierSnapshot.name,
			},
			{
				id: 'orderDate',
				header: t('procurement:po.orderDate'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => formatBusinessDate(row.original.orderDate, i18n.language),
			},
			{
				id: 'status',
				header: t('procurement:po.status'),
				cell: ({ row }) => (
					<Badge variant={PO_STATUS_VARIANT[row.original.status]}>
						{t(`procurement:status.${row.original.status}`)}
					</Badge>
				),
			},
			{
				id: 'grandTotal',
				header: t('procurement:po.grandTotal'),
				meta: { align: 'right' },
				cell: ({ row }) => formatIdr(row.original.grandTotal),
			},
		],
		[t, i18n.language],
	);

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('procurement:pos.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('procurement:pos.description')}</p>
				</div>
				{canCreate && (
					<Button render={<Link to='/procurement/purchase-orders/new' />} nativeButton={false}>
						{t('procurement:pos.new')}
					</Button>
				)}
			</div>
			<div className='flex flex-wrap items-center gap-2'>
				<InputGroup className='max-w-sm'>
					<InputGroupAddon align='inline-start'>
						<Search aria-hidden='true' />
					</InputGroupAddon>
					<InputGroupInput
						type='search'
						aria-label={t('procurement:pos.search')}
						placeholder={t('procurement:pos.search')}
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
						setStatus(value === 'all' || value == null ? '' : (value as TPurchaseOrderStatus));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('procurement:po.status')} className='w-44'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('procurement:pos.allStatuses')}</SelectItem>
						{PURCHASE_ORDER_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`procurement:status.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<DataTableCard>
				{isError ? (
					<ErrorState error={error} />
				) : !isPending && data.rows.length === 0 ? (
					<EmptyState icon={ClipboardList} title={t('procurement:pos.empty')} />
				) : (
					<>
						<DataTable
							columns={columns}
							data={data?.rows ?? []}
							getRowId={(row) => row.id}
							loading={isPending}
						/>
						{data && data.pagination.totalPages > 1 && (
							<PaginationControls page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
						)}
					</>
				)}
			</DataTableCard>
		</div>
	);
}
