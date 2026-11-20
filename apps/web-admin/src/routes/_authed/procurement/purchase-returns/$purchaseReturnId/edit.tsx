import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { PurchaseReturnForm } from '@/components/procurement/purchase-return-form';
import { ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { purchaseReturnQueryOptions, returnableReceiptsQueryOptions, updatePurchaseReturn } from '@/lib/purchase-return-api';

/** `/procurement/purchase-returns/$purchaseReturnId/edit` — change a draft return. */
export const Route = createFileRoute('/_authed/procurement/purchase-returns/$purchaseReturnId/edit')({
	component: EditPurchaseReturnPage,
});

function EditPurchaseReturnPage() {
	const { t } = useTranslation(['procurement', 'common']);
	const { purchaseReturnId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const detail = useQuery(purchaseReturnQueryOptions(purchaseReturnId));
	const receipts = useQuery(returnableReceiptsQueryOptions());

	if (detail.isError) return <ErrorState error={detail.error} bordered />;
	if (receipts.isError) return <ErrorState error={receipts.error} bordered />;
	if (detail.isPending || receipts.isPending) return <PageSkeleton cards={1} />;

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('procurement:returns.edit')}</h1>
				<p className='text-sm text-muted-foreground'>{detail.data.goodsReceiptCode}</p>
			</div>
			<PurchaseReturnForm
				receipts={receipts.data}
				initial={detail.data}
				onSubmit={async (input) => {
					try {
						await updatePurchaseReturn(purchaseReturnId, input);
						await queryClient.invalidateQueries({ queryKey: ['procurement'] });
						toast.success(t('procurement:returns.saved'));
						void navigate({ to: '/procurement/purchase-returns/$purchaseReturnId', params: { purchaseReturnId } });
					} catch (cause) {
						toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
					}
				}}
			/>
		</div>
	);
}
