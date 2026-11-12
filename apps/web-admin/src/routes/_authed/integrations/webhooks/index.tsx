import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@ims-erp/ui/components/alert';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import {
	OUTBOX_STATUS_VARIANT,
	OUTBOX_STATUSES,
	OUTBOX_TOPICS,
	outboxQueryOptions,
	outboxSummaryQueryOptions,
	retryOutbox,
	type TOutboxStatus,
	type TOutboxTopic,
} from '@/lib/automation-api';
import { formatDateTime } from '@/lib/format';
import { usePermission } from '@/lib/use-permission';

/** `/integrations/webhooks` — ERP events sent to n8n, with manual send (M04). */
export const Route = createFileRoute('/_authed/integrations/webhooks/')({
	component: WebhooksPage,
});

const select = 'h-9 rounded-md border bg-transparent px-3 text-sm';

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

	const send = async (id: string) => {
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
	};

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
				<select
					aria-label={t('integrations:outbox.event')}
					className={select}
					value={topic}
					onChange={(event) => {
						setTopic(event.target.value as TOutboxTopic | '');
						setPage(1);
					}}
				>
					<option value=''>{t('integrations:outbox.allTopics')}</option>
					{OUTBOX_TOPICS.map((value) => (
						<option key={value} value={value}>
							{t(`integrations:outbox.topic.${value}`)}
						</option>
					))}
				</select>
				<select
					aria-label={t('integrations:outbox.result')}
					className={select}
					value={status}
					onChange={(event) => {
						setStatus(event.target.value as TOutboxStatus | '');
						setPage(1);
					}}
				>
					<option value=''>{t('integrations:outbox.allStatuses')}</option>
					{OUTBOX_STATUSES.map((value) => (
						<option key={value} value={value}>
							{t(`integrations:outbox.status.${value}`)}
						</option>
					))}
				</select>
			</div>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('integrations:outbox.empty')}</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('integrations:outbox.at')}</TableHead>
										<TableHead>{t('integrations:outbox.event')}</TableHead>
										<TableHead>{t('integrations:outbox.record')}</TableHead>
										<TableHead className='text-right'>{t('integrations:outbox.attempts')}</TableHead>
										<TableHead>{t('integrations:outbox.result')}</TableHead>
										<TableHead />
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((message) => (
										<TableRow key={message.id}>
											<TableCell className='whitespace-nowrap'>{formatDateTime(message.createdAt, i18n.language)}</TableCell>
											<TableCell>
												{t(`integrations:outbox.topic.${message.topic}`)}
												<div className='font-mono text-xs text-muted-foreground'>{message.id}</div>
											</TableCell>
											<TableCell className='max-w-64 truncate text-sm'>
												{String(message.payload.reference ?? message.payload.name ?? message.aggregateId ?? '—')}
											</TableCell>
											<TableCell className='text-right tabular-nums'>{message.attempts}</TableCell>
											<TableCell>
												<Badge variant={OUTBOX_STATUS_VARIANT[message.status]}>{t(`integrations:outbox.status.${message.status}`)}</Badge>
												{(message.responseStatus || message.errorMessage) && (
													<div className='max-w-72 truncate text-xs text-muted-foreground'>
														{message.responseStatus ? `HTTP ${message.responseStatus} ` : ''}
														{message.errorMessage ?? ''}
													</div>
												)}
											</TableCell>
											<TableCell className='text-right'>
												{canSend && message.status !== 'published' && (
													<Button size='sm' variant='outline' disabled={busy === message.id} onClick={() => void send(message.id)}>
														{t('integrations:outbox.send')}
													</Button>
												)}
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
