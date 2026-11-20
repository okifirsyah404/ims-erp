import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import { toast } from '@/components/toast';
import { changeRequestsQueryOptions, decideChangeRequest, type TChangeRequest, type TCompanyChanges } from '@/lib/customer-change-request-api';
import { usePermission } from '@/lib/use-permission';

const FIELDS = ['name', 'taxId', 'industry'] as const satisfies readonly (keyof TCompanyChanges)[];

/**
 * Company-data changes the customer asked for in the portal (ERP-0076).
 * Staff with `customer:update` approve (the values are written to the
 * customer) or reject. Hidden while there has never been a request.
 */
export function ChangeRequestsCard({ customerId }: { customerId: string }) {
	const { t } = useTranslation(['crm', 'common']);
	const queryClient = useQueryClient();
	const canDecide = usePermission('customer.update');
	const { data = [] } = useQuery(changeRequestsQueryOptions(customerId));
	const [note, setNote] = useState('');
	const [busy, setBusy] = useState(false);

	if (data.length === 0) return null;

	const decide = async (entry: TChangeRequest, decision: 'approve' | 'reject') => {
		setBusy(true);
		try {
			await decideChangeRequest(customerId, entry.id, decision, note.trim() || undefined);
			setNote('');
			await queryClient.invalidateQueries({ queryKey: ['crm'] });
			toast.success(t(decision === 'approve' ? 'crm:changeRequests.approved' : 'crm:changeRequests.rejected'));
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};

	const show = (value: string | null | undefined) => value || '—';

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('crm:changeRequests.title')}</CardTitle>
				<CardDescription>{t('crm:changeRequests.description')}</CardDescription>
			</CardHeader>
			<CardContent className='flex flex-col gap-3 text-sm'>
				{data.slice(0, 5).map((entry) => (
					<div key={entry.id} className='flex flex-col gap-2 rounded-md border p-3'>
						<div className='flex flex-wrap items-center gap-2'>
							<Badge variant={entry.status === 'pending' ? 'default' : 'outline'}>{t(`crm:changeRequests.status.${entry.status}`)}</Badge>
							<span className='text-muted-foreground'>
								{t('crm:changeRequests.requestedBy', { name: entry.requestedByName ?? '—', date: new Date(entry.createdAt).toLocaleString() })}
							</span>
						</div>
						<ul className='flex flex-col gap-1'>
							{FIELDS.filter((field) => field in entry.changes).map((field) => (
								<li key={field}>
									<span className='font-medium'>{t(`crm:changeRequests.field.${field}`)}: </span>
									<span className='text-muted-foreground line-through'>{show(entry.previous[field])}</span> → <span>{show(entry.changes[field])}</span>
								</li>
							))}
						</ul>
						{entry.decisionNote && <p className='text-muted-foreground'>{entry.decisionNote}</p>}
						{entry.status === 'pending' && canDecide && (
							<div className='flex flex-wrap items-center gap-2'>
								<Input
									className='max-w-sm'
									value={note}
									maxLength={500}
									placeholder={t('crm:changeRequests.notePlaceholder')}
									aria-label={t('crm:changeRequests.notePlaceholder')}
									onChange={(event) => setNote(event.target.value)}
								/>
								<Button size='sm' disabled={busy} onClick={() => void decide(entry, 'approve')}>
									{t('crm:changeRequests.approve')}
								</Button>
								<Button size='sm' variant='outline' disabled={busy} onClick={() => void decide(entry, 'reject')}>
									{t('crm:changeRequests.reject')}
								</Button>
							</div>
						)}
					</div>
				))}
			</CardContent>
		</Card>
	);
}
