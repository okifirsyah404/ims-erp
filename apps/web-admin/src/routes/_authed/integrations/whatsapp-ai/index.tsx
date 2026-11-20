import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@ims-erp/ui/components/alert';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ims-erp/ui/components/input-group';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState } from '@/components/empty-state';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatDateTime } from '@/lib/format';
import {
	CONVERSATION_STATUS_VARIANT,
	CONVERSATION_STATUSES,
	conversationsQueryOptions,
	type TConversation,
	type TConversationStatus,
	whatsappStatusQueryOptions,
} from '@/lib/whatsapp-api';

/** `/integrations/whatsapp-ai` — WhatsApp chats and the handoff queue (M04 stage 2). */
export const Route = createFileRoute('/_authed/integrations/whatsapp-ai/')({
	component: WhatsappInboxPage,
});

function WhatsappInboxPage() {
	const { t, i18n } = useTranslation(['integrations', 'common']);
	const [status, setStatus] = useState<TConversationStatus | ''>('handoff');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const deferred = useDeferredValue(search.trim());
	const health = useQuery(whatsappStatusQueryOptions());
	const { data, isPending, isError, error } = useQuery(conversationsQueryOptions({ page, status: status || undefined, search: deferred || undefined }));
	const missing = health.data ? (['webhook', 'gateway', 'assistant'] as const).filter((part) => !health.data[part]) : [];

	const columns = useMemo<ColumnDef<DataTableFeatures, TConversation, CellData>[]>(
		() => [
			{
				id: 'contact',
				header: t('integrations:whatsapp.contact'),
				cell: ({ row }) => (
					<>
						<Link
							to='/integrations/whatsapp-ai/$conversationId'
							params={{ conversationId: row.original.id }}
							className='font-medium hover:underline'
						>
							{row.original.contactName ?? row.original.phone}
						</Link>
						<div className='text-xs text-muted-foreground'>+{row.original.phone}</div>
					</>
				),
			},
			{
				id: 'lastMessage',
				header: t('integrations:whatsapp.lastMessage'),
				meta: { cellClassName: 'max-w-96 truncate text-sm' },
				cell: ({ row }) => row.original.lastMessage ?? '—',
			},
			{
				id: 'state',
				header: t('integrations:whatsapp.state'),
				cell: ({ row }) => (
					<>
						<Badge variant={CONVERSATION_STATUS_VARIANT[row.original.status]}>
							{t(`integrations:whatsapp.status.${row.original.status}`)}
						</Badge>
						{row.original.status === 'handoff' && row.original.handoffReason && (
							<div className='text-xs text-muted-foreground'>
								{t(`integrations:whatsapp.reason.${row.original.handoffReason}`)}
							</div>
						)}
					</>
				),
			},
			{
				id: 'at',
				header: t('integrations:whatsapp.at'),
				meta: { cellClassName: 'whitespace-nowrap' },
				cell: ({ row }) => formatDateTime(row.original.lastMessageAt, i18n.language),
			},
		],
		[t, i18n.language],
	);

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('integrations:whatsapp.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('integrations:whatsapp.description')}</p>
				</div>
				<Button variant='outline' render={<Link to='/integrations/whatsapp-ai/faq' />}>
					{t('integrations:faq.title')}
				</Button>
			</div>
			{missing.length > 0 && (
				<Alert>
					<AlertDescription>
						<ul className='list-disc pl-4'>
							{missing.map((part) => (
								<li key={part}>{t(`integrations:whatsapp.missing.${part}`)}</li>
							))}
						</ul>
					</AlertDescription>
				</Alert>
			)}
			<div className='flex flex-wrap items-center gap-2'>
				{(['', ...CONVERSATION_STATUSES] as const).map((value) => (
					<Button
						key={value || 'all'}
						size='sm'
						variant={status === value ? 'default' : 'outline'}
						onClick={() => {
							setStatus(value);
							setPage(1);
						}}
					>
						{value ? t(`integrations:whatsapp.status.${value}`) : t('integrations:whatsapp.all')}
						{value && health.data?.counts[value] ? ` (${health.data.counts[value]})` : ''}
					</Button>
				))}
				<InputGroup className='ml-auto w-64'>
					<InputGroupAddon align='inline-start'>
						<Search aria-hidden='true' />
					</InputGroupAddon>
					<InputGroupInput
						type='search'
						aria-label={t('integrations:whatsapp.search')}
						placeholder={t('integrations:whatsapp.search')}
						value={search}
						onChange={(event) => {
							setSearch(event.target.value);
							setPage(1);
						}}
					/>
				</InputGroup>
			</div>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<EmptyState title={t('integrations:whatsapp.empty')} bordered />
			) : (
				<>
					<DataTable columns={columns} data={data.rows} getRowId={(row) => row.id} bordered />
					{data.pagination.totalPages > 1 && (
						<PaginationControls page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
					)}
				</>
			)}
		</div>
	);
}
