import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PurchaseRequestForm } from '@/components/procurement/purchase-request-form';
import { ErrorState } from '@/components/empty-state';
import { SectionSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { purchaseRequestQueryOptions, updatePurchaseRequest } from '@/lib/procurement-api';

/** `/procurement/purchase-requests/$purchaseRequestId/edit` — the requester edits their draft. */
export const Route = createFileRoute('/_authed/procurement/purchase-requests/$purchaseRequestId/edit')({
	component: EditPurchaseRequestPage,
});

function EditPurchaseRequestPage() {
	const { t } = useTranslation(['procurement', 'common']);
	const { purchaseRequestId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);
	const { data, isPending, isError, error } = useQuery(purchaseRequestQueryOptions(purchaseRequestId));
	const back = () => void navigate({ to: '/procurement/purchase-requests/$purchaseRequestId', params: { purchaseRequestId } });

	return (
		<div className='flex flex-col gap-6'>
			<h1 className='text-2xl font-bold'>{t('procurement:prs.edit')}</h1>
			{isPending ? (
				<SectionSkeleton lines={6} />
			) : isError ? (
				<ErrorState error={error} bordered />
			) : data.status !== 'draft' ? (
				<p className='text-sm text-muted-foreground'>{t('procurement:prs.onlyDraftEditable')}</p>
			) : (
				<PurchaseRequestForm
					request={data}
					submitting={submitting}
					onCancel={back}
					onSubmit={async (input) => {
						setSubmitting(true);
						try {
							await updatePurchaseRequest(purchaseRequestId, input);
							await queryClient.invalidateQueries({ queryKey: ['procurement', 'purchase-requests'] });
							toast.success(t('procurement:prs.saved'));
							back();
						} catch (cause) {
							toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
						} finally {
							setSubmitting(false);
						}
					}}
				/>
			)}
		</div>
	);
}
