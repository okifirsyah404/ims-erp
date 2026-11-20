import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { SalesReturnForm } from '@/components/sales/sales-return-form';
import { ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { salesReturnQueryOptions, returnableDeliveriesQueryOptions, updateSalesReturn } from '@/lib/sales-return-api';

/** `/sales/returns/$salesReturnId/edit` — change a draft return. */
export const Route = createFileRoute('/_authed/sales/returns/$salesReturnId/edit')({
	component: EditSalesReturnPage,
});

function EditSalesReturnPage() {
	const { t } = useTranslation(['sales', 'common']);
	const { salesReturnId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const detail = useQuery(salesReturnQueryOptions(salesReturnId));
	const receipts = useQuery(returnableDeliveriesQueryOptions());

	if (detail.isError) return <ErrorState error={detail.error} bordered />;
	if (receipts.isError) return <ErrorState error={receipts.error} bordered />;
	if (detail.isPending || receipts.isPending) return <PageSkeleton cards={1} />;

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('sales:returns.edit')}</h1>
				<p className='text-sm text-muted-foreground'>{detail.data.deliveryNoteCode}</p>
			</div>
			<SalesReturnForm
				receipts={receipts.data}
				initial={detail.data}
				onSubmit={async (input) => {
					try {
						await updateSalesReturn(salesReturnId, input);
						await queryClient.invalidateQueries({ queryKey: ['sales'] });
						toast.success(t('sales:returns.saved'));
						void navigate({ to: '/sales/returns/$salesReturnId', params: { salesReturnId } });
					} catch (cause) {
						toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
					}
				}}
			/>
		</div>
	);
}
