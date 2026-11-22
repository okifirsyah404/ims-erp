import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ims-erp/ui/components/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatDateTime } from '@/lib/format';
import {
	TICKET_STATUS_VARIANT,
	TICKET_STATUSES,
	ticketsQueryOptions,
	type TServiceTicket,
	type TTicketStatus,
} from '@/lib/service-ticket-api';
import { usePermission } from '@/lib/use-permission';

/** `/tickets` — service tickets (M07, ADR-0011 step 6c). */
export const Route = createFileRoute('/_authed/tickets/')({
	component: TicketListPage,
});

function TicketListPage() {
	const { t, i18n } = useTranslation(['projects', 'common']);
	const canCreate = usePermission('service_ticket.create');
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState<TTicketStatus | ''>('');
	const [search, setSearch] = useState('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(ticketsQueryOptions({ page, search: deferredSearch || undefined, status: status || undefined }));

	const columns = useMemo<ColumnDef<DataTableFeatures, TServiceTicket, CellData>[]>(
		() => [
			{
				id: 'code',
				header: t('projects:field.code'),
				cell: ({ row }) => (
					<>
						<Link
							to='/tickets/$ticketId'
							params={{ ticketId: row.original.id }}
							className='font-medium hover:underline'
						>
							{row.original.code}
						</Link>
						<div className='text-xs text-muted-foreground'>
							{formatDateTime(row.original.reportedAt, i18n.language)}
						</div>
					</>
				),
			},
			{ accessorKey: 'customerName', header: t('projects:ticket.customer') },
			{
				accessorKey: 'complaint',
				header: t('projects:ticket.complaint'),
				meta: { cellClassName: 'max-w-72 truncate' },
			},
			{
				id: 'warranty',
				header: t('projects:ticket.warranty'),
				cell: ({ row }) => (
					<Badge variant={row.original.inWarranty ? 'default' : 'outline'}>
						{row.original.inWarranty
							? t('projects:ticket.inWarranty')
							: t('projects:ticket.outOfWarranty')}
					</Badge>
				),
			},
			{
				id: 'assignee',
				header: t('projects:ticket.assignee'),
				cell: ({ row }) => row.original.assignee?.name ?? '—',
			},
			{
				id: 'status',
				header: t('projects:field.status'),
				cell: ({ row }) => (
					<Badge variant={TICKET_STATUS_VARIANT[row.original.status]}>
						{t(`projects:ticketStatus.${row.original.status}`)}
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
					<h1 className='text-2xl font-bold'>{t('projects:tickets.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('projects:tickets.description')}</p>
				</div>
				{canCreate && (
					<Button render={<Link to='/tickets/new' />} nativeButton={false}>
						{t('projects:tickets.new')}
					</Button>
				)}
			</div>
			<div className='flex flex-wrap gap-2'>
				<Select
					value={status || 'all'}
					onValueChange={(value: string | null) => {
						setStatus(value === null || value === 'all' ? '' : (value as TTicketStatus));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('projects:field.status')}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('projects:list.allStatuses')}</SelectItem>
						{TICKET_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`projects:ticketStatus.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<InputGroup className='max-w-sm'>
					<InputGroupAddon align='inline-start'>
						<Search aria-hidden='true' />
					</InputGroupAddon>
					<InputGroupInput
						type='search'
						aria-label={t('projects:tickets.search')}
						placeholder={t('projects:tickets.search')}
						value={search}
						onChange={(event) => {
							setSearch(event.target.value);
							setPage(1);
						}}
					/>
				</InputGroup>
			</div>
			<DataTableCard>
				{isError ? (
					<ErrorState error={error} />
				) : !isPending && data.rows.length === 0 ? (
					<EmptyState title={t('projects:tickets.empty')} />
				) : (
					<>
						<DataTable columns={columns} data={data?.rows ?? []} getRowId={(row) => row.id} loading={isPending} />
						{data && data.pagination.totalPages > 1 && (
							<PaginationControls page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
						)}
					</>
				)}
			</DataTableCard>
		</div>
	);
}
