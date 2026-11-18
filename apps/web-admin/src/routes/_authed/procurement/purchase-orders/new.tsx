import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PurchaseOrderForm } from '@/components/procurement/purchase-order-form';
import { toast } from '@/components/toast';
import { createPurchaseOrder } from '@/lib/procurement-api';

/** `/procurement/purchase-orders/new` — a new draft purchase order. */
export const Route = createFileRoute('/_authed/procurement/purchase-orders/new')({
	/** `?fromRequest=<id>` prefills the open lines of an approved purchase request. */
	validateSearch: (search: Record<string, unknown>): { fromRequest?: string } =>
		typeof search.fromRequest === 'string' ? { fromRequest: search.fromRequest } : {},
	component: NewPurchaseOrderPage,
});

function NewPurchaseOrderPage() {
	const { t } = useTranslation(['procurement', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);
	const { fromRequest } = Route.useSearch();

	return (
		<div className='flex flex-col gap-6'>
			<h1 className='text-2xl font-bold'>{t('procurement:pos.new')}</h1>
			<PurchaseOrderForm
				order={null}
				fromRequestId={fromRequest}
				submitting={submitting}
				onCancel={() => void navigate({ to: '/procurement/purchase-orders' })}
				onSubmit={async (input) => {
					setSubmitting(true);
					try {
						const created = await createPurchaseOrder(input);
						await queryClient.invalidateQueries({ queryKey: ['procurement'] });
						toast.success(t('procurement:pos.saved'));
						void navigate({ to: '/procurement/purchase-orders/$purchaseOrderId', params: { purchaseOrderId: created.id } });
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
