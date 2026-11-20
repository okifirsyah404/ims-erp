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
import { PaginationControls } from '@/components/pagination/pagination-controls';
import {
	DELIVERY_NOTE_STATUS_VARIANT,
	deliveryNotesQueryOptions,
	type TDeliveryNote,
} from '@/lib/delivery-note-api';
import { formatBusinessDate } from '@/lib/format';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

/** `/sales/deliveries` — delivery notes / surat jalan (ADR-0011 step 5a). */
export const Route = createFileRoute('/_authed/sales/deliveries/')({
	component: DeliveryNoteListPage,
});

function DeliveryNoteListPage() {
	const { t, i18n } = useTranslation(['sales', 'common']);
	const canIssue = usePermission('stock.issue');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		deliveryNotesQueryOptions({ page, limit: PAGE_SIZE, search: deferredSearch || undefined }),
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TDeliveryNote, CellData>[]>(
		() => [
			{
				id: 'code',
				header: t('sales:delivery.code'),
				cell: ({ row }) => (
					<Link
						to='/sales/deliveries/$deliveryNoteId'
						params={{ deliveryNoteId: row.original.id }}
						className='font-medium hover:underline'
					>
						{row.original.code}
					</Link>
				),
			},
			{ accessorKey: 'orderCode', header: t('sales:delivery.order') },
			{
				id: 'recipient',
				header: t('sales:delivery.recipientName'),
				cell: ({ row }) => (
					<>
						<div>{row.original.recipientName}</div>
						{row.original.projectName && (
							<div className='text-xs text-muted-foreground'>{row.original.projectName}</div>
						)}
					</>
				),
			},
			{
				id: 'deliveryDate',
				header: t('sales:delivery.date'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => formatBusinessDate(row.original.deliveryDate, i18n.language),
			},
			{
				id: 'status',
				header: t('sales:delivery.status'),
				cell: ({ row }) => (
					<Badge variant={DELIVERY_NOTE_STATUS_VARIANT[row.original.status]}>
						{t(`sales:deliveryStatus.${row.original.status}`)}
					</Badge>
				),
			},
		],
		[t, i18n.language],
	);

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('sales:deliveries.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('sales:deliveries.description')}</p>
				</div>
				{canIssue && (
					<Button render={<Link to='/sales/deliveries/new' />} nativeButton={false}>
						{t('sales:deliveries.new')}
					</Button>
				)}
			</div>
			<InputGroup className='max-w-sm'>
				<InputGroupAddon align='inline-start'>
					<Search aria-hidden='true' />
				</InputGroupAddon>
				<InputGroupInput
					type='search'
					aria-label={t('sales:deliveries.search')}
					placeholder={t('sales:deliveries.search')}
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
				<EmptyState title={t('sales:deliveries.empty')} bordered />
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
