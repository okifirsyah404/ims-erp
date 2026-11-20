import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

import { Badge } from '@ims-erp/ui/components/badge';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState } from '@/components/empty-state';
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@ims-erp/ui/components/input-group';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatBusinessDate, formatIdr } from '@/lib/format';
import { receiptsQueryOptions, type TReceipt } from '@/lib/invoice-api';

const PAGE_SIZE = 20;

/** A list row: the receipt plus the joined invoice code and customer name. */
type TReceiptRow = TReceipt & { invoiceCode: string | null; customerName: string };

/** `/sales/receipts` — receipts (kwitansi) with their invoice (ADR-0011 step 3d-2). */
export const Route = createFileRoute('/_authed/sales/receipts/')({
	component: ReceiptsPage,
});

function ReceiptsPage() {
	const { t, i18n } = useTranslation(['finance', 'common']);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		receiptsQueryOptions({ page, limit: PAGE_SIZE, search: deferredSearch || undefined }),
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TReceiptRow, CellData>[]>(
		() => [
			{
				id: 'code',
				header: t('finance:receipt.code'),
				cell: ({ row }) => (
					<div className='flex flex-wrap items-center gap-2'>
						{row.original.code}
						{row.original.status === 'reversed' && (
							<Badge variant='outline'>{t('finance:receipt.reversedBadge')}</Badge>
						)}
					</div>
				),
			},
			{
				id: 'invoice',
				header: t('finance:invoice.code'),
				cell: ({ row }) =>
					row.original.invoiceId ? (
						<Link
							to='/sales/invoices/$invoiceId'
							params={{ invoiceId: row.original.invoiceId }}
							className='hover:underline'
						>
							{row.original.invoiceCode ?? '-'}
						</Link>
					) : (
						<span>{row.original.invoiceCode ?? '-'}</span>
					),
			},
			{ accessorKey: 'customerName', header: t('finance:invoice.customer') },
			{
				id: 'receivedDate',
				header: t('finance:receipt.date'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => formatBusinessDate(row.original.receivedDate, i18n.language),
			},
			{
				id: 'method',
				header: t('finance:receipt.method'),
				cell: ({ row }) => t(`finance:method.${row.original.method}`),
			},
			{
				id: 'amount',
				header: t('finance:receipt.amount'),
				meta: { align: 'right' },
				cell: ({ row }) => formatIdr(row.original.amount),
			},
		],
		[t, i18n.language],
	);

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('finance:receipts.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('finance:receipts.description')}</p>
			</div>
			<InputGroup className='max-w-sm'>
				<InputGroupAddon align='inline-start'>
					<Search aria-hidden='true' />
				</InputGroupAddon>
				<InputGroupInput
					type='search'
					aria-label={t('finance:receipts.search')}
					placeholder={t('finance:receipts.search')}
					value={search}
					onChange={(e) => {
						setSearch(e.target.value);
						setPage(1);
					}}
				/>
			</InputGroup>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<EmptyState
					title={deferredSearch ? t('finance:receipts.noResults') : t('finance:receipt.empty')}
					bordered
				/>
			) : (
				<>
					<DataTable columns={columns} data={data.rows} getRowId={(row) => row.id} bordered />
					{data.pagination.totalPages > 1 && (
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
