import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { PurchaseReturnForm } from '@/components/procurement/purchase-return-form';
import { ErrorState } from '@/components/empty-state';
import { SectionSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { createPurchaseReturn, returnableReceiptsQueryOptions } from '@/lib/purchase-return-api';

/** A return may start from a goods receipt page. */
const searchSchema = z.object({ goodsReceiptId: z.string().optional() });

/** `/procurement/purchase-returns/new` — return received goods to the supplier (ERP-0068). */
export const Route = createFileRoute('/_authed/procurement/purchase-returns/new')({
	validateSearch: searchSchema,
	component: NewPurchaseReturnPage,
});

function NewPurchaseReturnPage() {
	const { t } = useTranslation(['procurement', 'common']);
	const search = Route.useSearch();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const receipts = useQuery(returnableReceiptsQueryOptions());

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('procurement:returns.new')}</h1>
				<p className='text-sm text-muted-foreground'>{t('procurement:returns.newHint')}</p>
			</div>
			{receipts.isPending ? (
				<SectionSkeleton lines={6} />
			) : receipts.isError ? (
				<ErrorState error={receipts.error} bordered />
			) : (
				<PurchaseReturnForm
					receipts={receipts.data}
					initialReceiptId={search.goodsReceiptId}
					onSubmit={async (input) => {
						try {
							const created = await createPurchaseReturn(input);
							await queryClient.invalidateQueries({ queryKey: ['procurement'] });
							toast.success(t('procurement:returns.saved'));
							void navigate({ to: '/procurement/purchase-returns/$purchaseReturnId', params: { purchaseReturnId: created.id } });
						} catch (cause) {
							toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
						}
					}}
				/>
			)}
		</div>
	);
}
