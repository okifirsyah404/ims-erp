import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Field, FieldLabel } from '@ims-erp/ui/components/field';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { toast } from '@/components/toast';
import { formatDateTime } from '@/lib/format';
import { addTicketComment, ticketCommentsQueryOptions } from '@/lib/service-ticket-api';

/**
 * The ticket's message thread (ERP-0022): internal notes, replies the
 * customer sees in the portal, and the customer's own messages.
 */
export function TicketThread({ ticketId, canWrite, closed }: { ticketId: string; canWrite: boolean; closed: boolean }) {
	const { t, i18n } = useTranslation(['projects', 'common']);
	const queryClient = useQueryClient();
	const { data: comments = [] } = useQuery(ticketCommentsQueryOptions(ticketId));
	const [body, setBody] = useState('');
	const [toCustomer, setToCustomer] = useState(false);
	const [busy, setBusy] = useState(false);

	const send = async () => {
		setBusy(true);
		try {
			await addTicketComment(ticketId, { body: body.trim(), visibility: toCustomer ? 'customer' : 'internal' });
			await queryClient.invalidateQueries({ queryKey: ['tickets', 'comments', ticketId] });
			setBody('');
			toast.success(t('projects:thread.sent'));
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('projects:thread.title')}</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col gap-3 text-sm'>
				{comments.length === 0 && <p className='text-muted-foreground'>{t('projects:thread.empty')}</p>}
				{comments.map((comment) => (
					<div
						key={comment.id}
						className={`rounded-md border px-3 py-2 ${comment.authorType === 'customer' ? 'bg-muted' : comment.visibility === 'internal' ? 'border-dashed' : ''}`}
					>
						<div className='mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
							<span className='font-medium text-foreground'>{comment.authorName}</span>
							<Badge variant={comment.authorType === 'customer' ? 'default' : comment.visibility === 'internal' ? 'outline' : 'secondary'}>
								{comment.authorType === 'customer'
									? t('projects:thread.fromCustomer')
									: comment.visibility === 'internal'
										? t('projects:thread.internal')
										: t('projects:thread.toCustomer')}
							</Badge>
							<span>{formatDateTime(comment.createdAt, i18n.language)}</span>
						</div>
						<p className='whitespace-pre-wrap'>{comment.body}</p>
					</div>
				))}
				{canWrite && !closed && (
					<form
						className='flex flex-col gap-2'
						onSubmit={(event) => {
							event.preventDefault();
							void send();
						}}
					>
						<Field>
							<FieldLabel htmlFor='ticket-comment'>{t('projects:thread.message')}</FieldLabel>
							<Textarea id='ticket-comment' required maxLength={4000} rows={3} value={body} onChange={(event) => setBody(event.target.value)} />
						</Field>
						<Field orientation='horizontal'>
							<Checkbox id='ticket-to-customer' checked={toCustomer} onCheckedChange={(checked) => setToCustomer(checked === true)} />
							<FieldLabel htmlFor='ticket-to-customer'>{t('projects:thread.visibleToCustomer')}</FieldLabel>
						</Field>
						<div>
							<Button type='submit' disabled={busy || !body.trim()}>
								{t('projects:thread.send')}
							</Button>
						</div>
					</form>
				)}
			</CardContent>
		</Card>
	);
}
