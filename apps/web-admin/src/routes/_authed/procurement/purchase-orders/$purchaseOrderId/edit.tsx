import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PurchaseOrderForm } from '@/components/procurement/purchase-order-form';
import { ErrorState } from '@/components/empty-state';
import { SectionSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { purchaseOrderQueryOptions, updatePurchaseOrder } from '@/lib/procurement-api';

/** `/procurement/purchase-orders/$purchaseOrderId/edit` — edit a draft. */
export const Route = createFileRoute('/_authed/procurement/purchase-orders/$purchaseOrderId/edit')({
	component: EditPurchaseOrderPage,
});

function EditPurchaseOrderPage() {
	const { t } = useTranslation(['procurement', 'common']);
	const { purchaseOrderId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);
	const { data, isPending, isError, error } = useQuery(purchaseOrderQueryOptions(purchaseOrderId));
	const back = () => void navigate({ to: '/procurement/purchase-orders/$purchaseOrderId', params: { purchaseOrderId } });

	return (
		<div className='flex flex-col gap-6'>
			<h1 className='text-2xl font-bold'>{t('procurement:pos.edit')}</h1>
			{isPending ? (
				<SectionSkeleton lines={6} />
			) : isError ? (
				<ErrorState error={error} bordered />
			) : data.status !== 'draft' ? (
				<p className='text-sm text-muted-foreground'>{t('procurement:pos.onlyDraftEditable')}</p>
			) : (
				<PurchaseOrderForm
					order={data}
					submitting={submitting}
					onCancel={back}
					onSubmit={async (input) => {
						setSubmitting(true);
						try {
							await updatePurchaseOrder(purchaseOrderId, input);
							await queryClient.invalidateQueries({ queryKey: ['procurement'] });
							toast.success(t('procurement:pos.saved'));
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
