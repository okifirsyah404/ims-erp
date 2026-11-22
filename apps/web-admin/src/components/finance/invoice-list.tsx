import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { Field, FieldLabel } from '@ims-erp/ui/components/field';
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
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatBusinessDate, formatIdr, todayBusinessDate } from '@/lib/format';
import {
	INVOICE_STATUS_VARIANT,
	INVOICE_STATUSES,
	invoicesQueryOptions,
	isOverdue,
	type TInvoice,
	type TInvoiceStatus,
	type TInvoiceTermKind,
} from '@/lib/invoice-api';

const PAGE_SIZE = 20;

/** Invoice list with search and filters; `termKind` narrows it (the DP menu). */
export function InvoiceList({ title, description, termKind }: { title: string; description: string; termKind?: TInvoiceTermKind }) {
	const { t, i18n } = useTranslation(['finance', 'common']);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<TInvoiceStatus | ''>('');
	const [overdue, setOverdue] = useState(false);
	const deferredSearch = useDeferredValue(search.trim());
	const filtered = deferredSearch !== '' || status !== '' || overdue;
	const today = todayBusinessDate();
	const { data, isPending, isError, error } = useQuery(
		invoicesQueryOptions({
			page,
			limit: PAGE_SIZE,
			search: deferredSearch || undefined,
			status: status || undefined,
			termKind,
			overdue,
		}),
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TInvoice, CellData>[]>(
		() => [
			{
				id: 'code',
				header: t('finance:invoice.code'),
				cell: ({ row }) => (
					<>
						<Link
							to='/sales/invoices/$invoiceId'
							params={{ invoiceId: row.original.id }}
							className='font-medium hover:underline'
						>
							{row.original.code ?? t('finance:invoice.draftNumber')}
						</Link>
						<div className='text-xs text-muted-foreground'>{row.original.orderCode}</div>
					</>
				),
			},
			{
				id: 'customer',
				header: t('finance:invoice.customer'),
				cell: ({ row }) => row.original.customerSnapshot?.name ?? '-',
			},
			{ accessorKey: 'description', header: t('finance:invoice.description') },
			{
				id: 'dueDate',
				header: t('finance:invoice.dueDate'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => formatBusinessDate(row.original.dueDate, i18n.language),
			},
			{
				id: 'status',
				header: t('finance:invoice.status'),
				cell: ({ row }) => (
					<div className='flex flex-wrap gap-1'>
						<Badge variant={INVOICE_STATUS_VARIANT[row.original.status]}>
							{t(`finance:status.${row.original.status}`)}
						</Badge>
						{isOverdue(row.original, today) && (
							<Badge variant='destructive'>{t('finance:invoice.overdue')}</Badge>
						)}
					</div>
				),
			},
			{
				id: 'grandTotal',
				header: t('finance:invoice.grandTotal'),
				meta: { align: 'right' },
				cell: ({ row }) => formatIdr(row.original.grandTotal),
			},
			{
				id: 'outstanding',
				header: t('finance:invoice.outstanding'),
				meta: { align: 'right' },
				cell: ({ row }) => formatIdr(row.original.outstandingTotal),
			},
		],
		[i18n.language, t, today],
	);

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{title}</h1>
				<p className='text-sm text-muted-foreground'>{description}</p>
			</div>

			<div className='flex flex-wrap items-center gap-2'>
				<InputGroup className='max-w-sm'>
					<InputGroupAddon align='inline-start'>
						<Search aria-hidden='true' />
					</InputGroupAddon>
					<InputGroupInput
						type='search'
						aria-label={t('finance:invoices.search')}
						placeholder={t('finance:invoices.search')}
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(1);
						}}
					/>
				</InputGroup>
				<Select
					value={status === '' ? 'all' : status}
					onValueChange={(value: string | null) => {
						setStatus(value == null || value === 'all' ? '' : (value as TInvoiceStatus));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('finance:invoice.status')}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('finance:invoices.allStatuses')}</SelectItem>
						{INVOICE_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`finance:status.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Field orientation='horizontal' className='w-auto'>
					<Checkbox
						id='invoice-overdue-only'
						checked={overdue}
						onCheckedChange={(checked) => {
							setOverdue(checked === true);
							setPage(1);
						}}
					/>
					<FieldLabel htmlFor='invoice-overdue-only'>
						{t('finance:invoices.overdueOnly')}
					</FieldLabel>
				</Field>
			</div>

			<DataTableCard title={t('finance:invoices.title')}>
				{isError ? (
					<ErrorState error={error} />
				) : !isPending && data.rows.length === 0 ? (
					<EmptyState
						title={filtered ? t('finance:invoices.noResults') : t('finance:invoices.empty')}
					/>
				) : (
					<>
						<DataTable
							columns={columns}
							data={data?.rows ?? []}
							loading={isPending}
							getRowId={(row) => row.id}
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
