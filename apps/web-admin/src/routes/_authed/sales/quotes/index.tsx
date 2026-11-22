import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

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
	QUOTATION_STATUS_VARIANT,
	QUOTATION_STATUSES,
	quotationsQueryOptions,
	type TQuotation,
	type TQuotationStatus,
} from '@/lib/quotation-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

/** `/sales/quotes` — quotations (SPH) visible to the caller (ADR-0011 step 3c). */
export const Route = createFileRoute('/_authed/sales/quotes/')({
	component: QuotationListPage,
});

function QuotationListPage() {
	const { t, i18n } = useTranslation(['sales', 'common']);
	const canCreate = usePermission('quotation.create');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<TQuotationStatus | ''>('');
	const deferredSearch = useDeferredValue(search.trim());
	const filtered = deferredSearch !== '' || status !== '';
	const { data, isPending, isError, error } = useQuery(
		quotationsQueryOptions({
			page,
			limit: PAGE_SIZE,
			search: deferredSearch || undefined,
			status: status || undefined,
		}),
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TQuotation, CellData>[]>(
		() => [
			{
				id: 'code',
				header: t('sales:quotation.code'),
				cell: ({ row }) => (
					<>
						<Link
							to='/sales/quotes/$quotationId'
							params={{ quotationId: row.original.id }}
							className='font-medium hover:underline'
						>
							{row.original.code}
						</Link>
						<div className='text-xs text-muted-foreground'>{row.original.title}</div>
					</>
				),
			},
			{
				id: 'customer',
				header: t('sales:quotation.customer'),
				cell: ({ row }) => row.original.customerSnapshot.name,
			},
			{
				id: 'quotationDate',
				header: t('sales:quotation.date'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => formatBusinessDate(row.original.quotationDate, i18n.language),
			},
			{
				id: 'status',
				header: t('sales:quotation.status'),
				cell: ({ row }) => (
					<div className='flex flex-wrap gap-1'>
						<Badge variant={QUOTATION_STATUS_VARIANT[row.original.status]}>
							{t(`sales:status.${row.original.status}`)}
						</Badge>
						{row.original.expired && <Badge variant='outline'>{t('sales:quotation.expired')}</Badge>}
					</div>
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
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('sales:quotations.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('sales:quotations.description')}</p>
				</div>
				{canCreate && (
					<Button render={<Link to='/sales/quotes/new' />} nativeButton={false}>
						{t('sales:quotations.new')}
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
						aria-label={t('sales:quotations.search')}
						placeholder={t('sales:quotations.search')}
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
						setStatus(value === 'all' || value == null ? '' : (value as TQuotationStatus));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('sales:quotation.status')} className='w-44'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('sales:quotations.allStatuses')}</SelectItem>
						{QUOTATION_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`sales:status.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<DataTableCard>
				{isError ? (
					<ErrorState error={error} />
				) : !isPending && data.rows.length === 0 ? (
					<EmptyState
						title={filtered ? t('sales:quotations.noResults') : t('sales:quotations.empty')}
					/>
				) : (
					<>
						<DataTable
							columns={columns}
							data={data?.rows ?? []}
							getRowId={(row) => row.id}
							loading={isPending}
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
			</DataTableCard>
		</div>
	);
}
