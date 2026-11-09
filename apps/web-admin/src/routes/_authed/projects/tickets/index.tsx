import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatDateTime } from '@/lib/format';
import { TICKET_STATUS_VARIANT, TICKET_STATUSES, ticketsQueryOptions, type TTicketStatus } from '@/lib/service-ticket-api';
import { usePermission } from '@/lib/use-permission';

/** `/projects/tickets` — service tickets (M07, ADR-0011 step 6c). */
export const Route = createFileRoute('/_authed/projects/tickets/')({
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

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('projects:tickets.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('projects:tickets.description')}</p>
				</div>
				{canCreate && (
					<Button render={<Link to='/projects/tickets/new' />} nativeButton={false}>
						{t('projects:tickets.new')}
					</Button>
				)}
			</div>
			<div className='flex flex-wrap gap-2'>
				<select
					aria-label={t('projects:field.status')}
					className='h-9 rounded-md border bg-transparent px-3 text-sm'
					value={status}
					onChange={(event) => {
						setStatus(event.target.value as TTicketStatus | '');
						setPage(1);
					}}
				>
					<option value=''>{t('projects:list.allStatuses')}</option>
					{TICKET_STATUSES.map((value) => (
						<option key={value} value={value}>
							{t(`projects:ticketStatus.${value}`)}
						</option>
					))}
				</select>
				<Input
					type='search'
					className='max-w-sm'
					aria-label={t('projects:tickets.search')}
					placeholder={t('projects:tickets.search')}
					value={search}
					onChange={(event) => {
						setSearch(event.target.value);
						setPage(1);
					}}
				/>
			</div>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('projects:tickets.empty')}</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('projects:field.code')}</TableHead>
										<TableHead>{t('projects:ticket.customer')}</TableHead>
										<TableHead>{t('projects:ticket.complaint')}</TableHead>
										<TableHead>{t('projects:ticket.warranty')}</TableHead>
										<TableHead>{t('projects:ticket.assignee')}</TableHead>
										<TableHead>{t('projects:field.status')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((ticket) => (
										<TableRow key={ticket.id}>
											<TableCell>
												<Link to='/projects/tickets/$ticketId' params={{ ticketId: ticket.id }} className='font-medium hover:underline'>
													{ticket.code}
												</Link>
												<div className='text-xs text-muted-foreground'>{formatDateTime(ticket.reportedAt, i18n.language)}</div>
											</TableCell>
											<TableCell>{ticket.customerName}</TableCell>
											<TableCell className='max-w-72 truncate'>{ticket.complaint}</TableCell>
											<TableCell>
												<Badge variant={ticket.inWarranty ? 'default' : 'outline'}>
													{ticket.inWarranty ? t('projects:ticket.inWarranty') : t('projects:ticket.outOfWarranty')}
												</Badge>
											</TableCell>
											<TableCell>{ticket.assignee?.name ?? '—'}</TableCell>
											<TableCell>
												<Badge variant={TICKET_STATUS_VARIANT[ticket.status]}>{t(`projects:ticketStatus.${ticket.status}`)}</Badge>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
					{data.pagination.totalPages > 1 && (
						<PaginationControls page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
					)}
				</>
			)}
		</div>
	);
}
