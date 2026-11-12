import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Field, FieldLabel } from '@ims-erp/ui/components/field';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { toast } from '@/components/toast';
import { formatDateTime } from '@/lib/format';
import { usePermission } from '@/lib/use-permission';
import {
	CONVERSATION_STATUS_VARIANT,
	captureLead,
	closeConversation,
	conversationQueryOptions,
	replyToConversation,
	resumeConversation,
	retryMessage,
	type TWhatsappMessage,
} from '@/lib/whatsapp-api';

/** `/integrations/whatsapp-ai/$conversationId` — one chat: the log, admin replies, handing back (M04 stage 2). */
export const Route = createFileRoute('/_authed/integrations/whatsapp-ai/$conversationId')({
	component: ConversationPage,
});

function ConversationPage() {
	const { conversationId } = Route.useParams();
	const { t, i18n } = useTranslation(['integrations', 'common']);
	const queryClient = useQueryClient();
	const canReply = usePermission('whatsapp.reply');
	const canReadLead = usePermission('lead.read');
	const { data, isPending, isError, error } = useQuery(conversationQueryOptions(conversationId));
	const [text, setText] = useState('');
	const [busy, setBusy] = useState(false);

	const run = async (work: () => Promise<unknown>, done?: string) => {
		setBusy(true);
		try {
			const result = await work();
			await queryClient.invalidateQueries({ queryKey: ['whatsapp'] });
			const failed = (result as Partial<TWhatsappMessage> | undefined)?.status === 'failed';
			if (failed) toast.error(t('integrations:whatsapp.notSent', { reason: (result as TWhatsappMessage).errorMessage ?? '' }));
			else if (done) toast.success(done);
			return !failed;
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
			return false;
		} finally {
			setBusy(false);
		}
	};

	if (isPending) return null;
	if (isError) return <p className='p-6 text-sm text-destructive'>{error.message}</p>;

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<Link to='/integrations/whatsapp-ai' className='text-sm text-muted-foreground hover:underline'>
						← {t('integrations:whatsapp.title')}
					</Link>
					<h1 className='text-2xl font-bold'>{data.contactName ?? `+${data.phone}`}</h1>
					<p className='text-sm text-muted-foreground'>+{data.phone}</p>
					<div className='mt-1 flex items-center gap-2'>
						<Badge variant={CONVERSATION_STATUS_VARIANT[data.status]}>{t(`integrations:whatsapp.status.${data.status}`)}</Badge>
						{data.status === 'handoff' && data.handoffReason && (
							<span className='text-xs text-muted-foreground'>{t(`integrations:whatsapp.reason.${data.handoffReason}`)}</span>
						)}
					</div>
				</div>
				{canReply && (
					<div className='flex flex-wrap gap-2'>
						{data.leadId ? (
							canReadLead ? (
								<Button variant='outline' render={<Link to='/crm/leads/$leadId' params={{ leadId: data.leadId }} />}>
									{t('integrations:whatsapp.openLead')}
								</Button>
							) : (
								<span className='self-center text-sm text-muted-foreground'>{t('integrations:whatsapp.leadLinked')}</span>
							)
						) : (
							<Button variant='outline' disabled={busy} onClick={() => void run(() => captureLead(data.id), t('integrations:whatsapp.leadCreated'))}>
								{t('integrations:whatsapp.createLead')}
							</Button>
						)}
						{data.status !== 'assistant' && (
							<Button variant='outline' disabled={busy} onClick={() => void run(() => resumeConversation(data.id), t('integrations:whatsapp.resumed'))}>
								{t('integrations:whatsapp.resume')}
							</Button>
						)}
						{data.status !== 'closed' && (
							<Button variant='outline' disabled={busy} onClick={() => void run(() => closeConversation(data.id), t('integrations:whatsapp.closed'))}>
								{t('integrations:whatsapp.close')}
							</Button>
						)}
					</div>
				)}
			</div>
			<Card>
				<CardContent className='flex flex-col gap-3 py-4'>
					{data.messages.length === 0 && <p className='text-center text-sm text-muted-foreground'>{t('integrations:whatsapp.noMessages')}</p>}
					{data.messages.map((message) => {
						const inbound = message.direction === 'inbound';
						return (
							<div key={message.id} className={`flex flex-col ${inbound ? 'items-start' : 'items-end'}`}>
								<div className={`max-w-[75%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${inbound ? 'bg-muted' : 'bg-primary/10'}`}>
									{message.body}
								</div>
								<div className='mt-1 flex items-center gap-2 text-xs text-muted-foreground'>
									<span>{t(`integrations:whatsapp.author.${message.author}`)}</span>
									<span>{formatDateTime(message.createdAt, i18n.language)}</span>
									{message.status === 'failed' && (
										<>
											<span className='text-destructive'>{t('integrations:whatsapp.failed', { reason: message.errorMessage ?? '' })}</span>
											{canReply && (
												<Button size='sm' variant='outline' disabled={busy} onClick={() => void run(() => retryMessage(message.id), t('integrations:whatsapp.sent'))}>
													{t('integrations:whatsapp.retry')}
												</Button>
											)}
										</>
									)}
								</div>
							</div>
						);
					})}
				</CardContent>
			</Card>
			{canReply && (
				<form
					className='flex flex-col gap-2'
					onSubmit={async (event) => {
						event.preventDefault();
						if (await run(() => replyToConversation(data.id, text.trim()), t('integrations:whatsapp.sent'))) setText('');
					}}
				>
					<Field>
						<FieldLabel htmlFor='wa-reply'>{t('integrations:whatsapp.reply')}</FieldLabel>
						<Textarea id='wa-reply' required maxLength={4000} rows={3} value={text} onChange={(event) => setText(event.target.value)} />
					</Field>
					<p className='text-xs text-muted-foreground'>{t('integrations:whatsapp.replyHint')}</p>
					<div>
						<Button type='submit' disabled={busy || !text.trim()}>
							{t('integrations:whatsapp.send')}
						</Button>
					</div>
				</form>
			)}
		</div>
	);
}
