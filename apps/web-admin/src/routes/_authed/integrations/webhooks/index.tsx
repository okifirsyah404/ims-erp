import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@ims-erp/ui/components/alert';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState } from '@/components/empty-state';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import {
	OUTBOX_STATUS_VARIANT,
	OUTBOX_STATUSES,
	OUTBOX_TOPICS,
	outboxQueryOptions,
	outboxSummaryQueryOptions,
	retryOutbox,
	type TOutboxMessage,
	type TOutboxStatus,
	type TOutboxTopic,
} from '@/lib/automation-api';
import { formatDateTime } from '@/lib/format';
import { usePermission } from '@/lib/use-permission';

/** `/integrations/webhooks` — ERP events sent to n8n, with manual send (M04). */
export const Route = createFileRoute('/_authed/integrations/webhooks/')({
	component: WebhooksPage,
});

function WebhooksPage() {
	const { t, i18n } = useTranslation(['integrations', 'common']);
	const queryClient = useQueryClient();
	const canSend = usePermission('automation.execute');
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState<TOutboxStatus | ''>('');
	const [topic, setTopic] = useState<TOutboxTopic | ''>('');
	const summary = useQuery(outboxSummaryQueryOptions());
	const { data, isPending, isError, error } = useQuery(outboxQueryOptions({ page, status: status || undefined, topic: topic || undefined }));
	const [busy, setBusy] = useState<string | null>(null);

	const send = useCallback(
		async (id: string) => {
			setBusy(id);
			try {
				const message = await retryOutbox(id);
				await queryClient.invalidateQueries({ queryKey: ['automation'] });
				if (message.status === 'published') toast.success(t('integrations:outbox.sent'));
				else toast.error(t('integrations:outbox.notSent', { reason: message.errorMessage ?? message.status }));
			} catch (cause) {
				toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
			} finally {
				setBusy(null);
			}
		},
		[queryClient, t],
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TOutboxMessage, CellData>[]>(
		() => [
			{
				id: 'at',
				header: t('integrations:outbox.at'),
				meta: { cellClassName: 'whitespace-nowrap' },
				cell: ({ row }) => formatDateTime(row.original.createdAt, i18n.language),
			},
			{
				id: 'event',
				header: t('integrations:outbox.event'),
				cell: ({ row }) => (
					<>
						{t(`integrations:outbox.topic.${row.original.topic}`)}
						<div className='font-mono text-xs text-muted-foreground'>{row.original.id}</div>
					</>
				),
			},
			{
				id: 'record',
				header: t('integrations:outbox.record'),
				meta: { cellClassName: 'max-w-64 truncate text-sm' },
				cell: ({ row }) =>
					String(
						row.original.payload.reference ??
							row.original.payload.name ??
							row.original.aggregateId ??
							'—',
					),
			},
			{
				accessorKey: 'attempts',
				header: t('integrations:outbox.attempts'),
				meta: { align: 'right', cellClassName: 'tabular-nums' },
			},
			{
				id: 'result',
				header: t('integrations:outbox.result'),
				cell: ({ row }) => (
					<>
						<Badge variant={OUTBOX_STATUS_VARIANT[row.original.status]}>
							{t(`integrations:outbox.status.${row.original.status}`)}
						</Badge>
						{(row.original.responseStatus || row.original.errorMessage) && (
							<div className='max-w-72 truncate text-xs text-muted-foreground'>
								{row.original.responseStatus ? `HTTP ${row.original.responseStatus} ` : ''}
								{row.original.errorMessage ?? ''}
							</div>
						)}
					</>
				),
			},
			{
				id: 'actions',
				header: '',
				meta: { align: 'right' },
				cell: ({ row }) =>
					canSend && row.original.status !== 'published' ? (
						<Button
							size='sm'
							variant='outline'
							disabled={busy === row.original.id}
							onClick={() => void send(row.original.id)}
						>
							{t('integrations:outbox.send')}
						</Button>
					) : null,
			},
		],
		[t, i18n.language, canSend, busy, send],
	);

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('integrations:outbox.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('integrations:outbox.description')}</p>
			</div>
			{summary.data &&
				(summary.data.configured ? (
					<p className='text-sm text-muted-foreground'>{t('integrations:outbox.configured')}</p>
				) : (
					<Alert>
						<AlertDescription>{t('integrations:outbox.notConfigured')}</AlertDescription>
					</Alert>
				))}
			<div className='flex flex-wrap gap-2'>
				<Select
					value={topic || 'all'}
					onValueChange={(value: string | null) => {
						setTopic(value === 'all' || value == null ? '' : (value as TOutboxTopic));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('integrations:outbox.event')} className='w-44'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('integrations:outbox.allTopics')}</SelectItem>
						{OUTBOX_TOPICS.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`integrations:outbox.topic.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={status || 'all'}
					onValueChange={(value: string | null) => {
						setStatus(value === 'all' || value == null ? '' : (value as TOutboxStatus));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('integrations:outbox.result')} className='w-44'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('integrations:outbox.allStatuses')}</SelectItem>
						{OUTBOX_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`integrations:outbox.status.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<EmptyState title={t('integrations:outbox.empty')} bordered />
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
