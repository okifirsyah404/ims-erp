import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PurchaseRequestForm } from '@/components/procurement/purchase-request-form';
import { toast } from '@/components/toast';
import { createPurchaseRequest } from '@/lib/procurement-api';

/** `/procurement/purchase-requests/new` — a new draft purchase request. */
export const Route = createFileRoute('/_authed/procurement/purchase-requests/new')({
	component: NewPurchaseRequestPage,
});

function NewPurchaseRequestPage() {
	const { t } = useTranslation(['procurement', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);

	return (
		<div className='flex flex-col gap-6'>
			<h1 className='text-2xl font-bold'>{t('procurement:prs.new')}</h1>
			<PurchaseRequestForm
				request={null}
				submitting={submitting}
				onCancel={() => void navigate({ to: '/procurement/purchase-requests' })}
				onSubmit={async (input) => {
					setSubmitting(true);
					try {
						const created = await createPurchaseRequest(input);
						await queryClient.invalidateQueries({ queryKey: ['procurement', 'purchase-requests'] });
						toast.success(t('procurement:prs.saved'));
						void navigate({ to: '/procurement/purchase-requests/$purchaseRequestId', params: { purchaseRequestId: created.id } });
					} catch (cause) {
						toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
					} finally {
						setSubmitting(false);
					}
				}}
			/>
		</div>
	);
}
