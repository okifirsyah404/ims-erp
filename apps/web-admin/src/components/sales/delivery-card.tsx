import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { SectionSkeleton } from '@/components/page-skeleton';
import { DELIVERY_NOTE_STATUS_VARIANT, deliveryNotesQueryOptions } from '@/lib/delivery-note-api';
import { formatBusinessDate } from '@/lib/format';
import { usePermission } from '@/lib/use-permission';

/**
 * The delivery notes of one sales order, with "create" for the warehouse
 * while the order can still be delivered.
 */
export function DeliveryCard({ orderId, deliverable }: { orderId: string; deliverable: boolean }) {
	const { t, i18n } = useTranslation(['sales', 'common']);
	const canIssue = usePermission('stock.issue');
	const notes = useQuery(deliveryNotesQueryOptions({ orderId, limit: 50 }));

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('sales:deliveries.forOrder')}</CardTitle>
				{canIssue && deliverable && (
					<CardAction>
						<Button
							size='sm'
							render={<Link to='/sales/deliveries/new' search={{ salesOrderId: orderId }} />}
							nativeButton={false}
						>
							{t('sales:deliveries.createForOrder')}
						</Button>
					</CardAction>
				)}
			</CardHeader>
			<CardContent>
				{notes.isError ? (
					<ErrorState error={notes.error} size='sm' />
				) : notes.isPending ? (
					<SectionSkeleton />
				) : notes.data.rows.length === 0 ? (
					<EmptyState title={t('sales:deliveries.noneForOrder')} size='sm' />
				) : (
					<ul className='flex flex-col gap-2 text-sm'>
						{notes.data.rows.map((note) => (
							<li key={note.id} className='grid grid-cols-[1fr_auto_auto] items-center gap-4'>
								<Link
									to='/sales/deliveries/$deliveryNoteId'
									params={{ deliveryNoteId: note.id }}
									className='font-medium hover:underline'
								>
									{note.code}
								</Link>
								<span className='text-muted-foreground'>{formatBusinessDate(note.deliveryDate, i18n.language)}</span>
								<Badge variant={DELIVERY_NOTE_STATUS_VARIANT[note.status]}>{t(`sales:deliveryStatus.${note.status}`)}</Badge>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
