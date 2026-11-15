import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { SalesReturnForm } from '@/components/sales/sales-return-form';
import { toast } from '@/components/toast';
import { createSalesReturn, returnableDeliveriesQueryOptions } from '@/lib/sales-return-api';

/** A return may start from a delivery note page. */
const searchSchema = z.object({ deliveryNoteId: z.string().optional() });

/** `/sales/returns/new` — return received goods to the supplier (ERP-0065). */
export const Route = createFileRoute('/_authed/sales/returns/new')({
	validateSearch: searchSchema,
	component: NewSalesReturnPage,
});

function NewSalesReturnPage() {
	const { t } = useTranslation(['sales', 'common']);
	const search = Route.useSearch();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const receipts = useQuery(returnableDeliveriesQueryOptions());

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('sales:returns.new')}</h1>
				<p className='text-sm text-muted-foreground'>{t('sales:returns.newHint')}</p>
			</div>
			{receipts.isPending ? null : receipts.isError ? (
				<p className='text-sm text-destructive'>{receipts.error.message}</p>
			) : (
				<SalesReturnForm
					receipts={receipts.data}
					initialDeliveryId={search.deliveryNoteId}
					onSubmit={async (input) => {
						try {
							const created = await createSalesReturn(input);
							await queryClient.invalidateQueries({ queryKey: ['sales'] });
							toast.success(t('sales:returns.saved'));
							void navigate({ to: '/sales/returns/$salesReturnId', params: { salesReturnId: created.id } });
						} catch (cause) {
							toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
						}
					}}
				/>
			)}
		</div>
	);
}
