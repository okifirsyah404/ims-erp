import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@ims-erp/ui/components/alert';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatDateTime } from '@/lib/format';
import {
	CONVERSATION_STATUS_VARIANT,
	CONVERSATION_STATUSES,
	conversationsQueryOptions,
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
				<Input
					type='search'
					className='ml-auto w-64'
					aria-label={t('integrations:whatsapp.search')}
					placeholder={t('integrations:whatsapp.search')}
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
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('integrations:whatsapp.empty')}</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('integrations:whatsapp.contact')}</TableHead>
										<TableHead>{t('integrations:whatsapp.lastMessage')}</TableHead>
										<TableHead>{t('integrations:whatsapp.state')}</TableHead>
										<TableHead>{t('integrations:whatsapp.at')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((conversation) => (
										<TableRow key={conversation.id}>
											<TableCell>
												<Link
													to='/integrations/whatsapp-ai/$conversationId'
													params={{ conversationId: conversation.id }}
													className='font-medium hover:underline'
												>
													{conversation.contactName ?? conversation.phone}
												</Link>
												<div className='text-xs text-muted-foreground'>+{conversation.phone}</div>
											</TableCell>
											<TableCell className='max-w-96 truncate text-sm'>{conversation.lastMessage ?? '—'}</TableCell>
											<TableCell>
												<Badge variant={CONVERSATION_STATUS_VARIANT[conversation.status]}>{t(`integrations:whatsapp.status.${conversation.status}`)}</Badge>
												{conversation.status === 'handoff' && conversation.handoffReason && (
													<div className='text-xs text-muted-foreground'>{t(`integrations:whatsapp.reason.${conversation.handoffReason}`)}</div>
												)}
											</TableCell>
											<TableCell className='whitespace-nowrap'>{formatDateTime(conversation.lastMessageAt, i18n.language)}</TableCell>
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
