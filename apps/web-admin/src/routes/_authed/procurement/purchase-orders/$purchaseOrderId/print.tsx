import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { ErrorState } from '@/components/empty-state';

import { Button } from '@ims-erp/ui/components/button';
import { PurchaseOrderDocument } from '@/components/procurement/purchase-order-document';
import { companyProfileQueryOptions } from '@/lib/company-api';
import { purchaseOrderQueryOptions } from '@/lib/procurement-api';

/** `/procurement/purchase-orders/$purchaseOrderId/print` — the printable PO. */
export const Route = createFileRoute('/_authed/procurement/purchase-orders/$purchaseOrderId/print')({
	component: PrintPurchaseOrderPage,
});

function PrintPurchaseOrderPage() {
	const { t } = useTranslation(['procurement', 'common']);
	const { purchaseOrderId } = Route.useParams();
	const order = useQuery(purchaseOrderQueryOptions(purchaseOrderId));
	const profile = useQuery(companyProfileQueryOptions());

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex justify-between gap-2 print:hidden'>
				<Button
					variant='outline'
					render={<Link to='/procurement/purchase-orders/$purchaseOrderId' params={{ purchaseOrderId }} />}
					nativeButton={false}
				>
					{t('procurement:pos.backToOrder')}
				</Button>
				<Button onClick={() => window.print()} disabled={!order.data}>
					{t('procurement:po.print')}
				</Button>
			</div>
			{order.isError ? (
				<ErrorState error={order.error} />
			) : order.data && !profile.isPending ? (
				<div className='mx-auto w-full max-w-4xl rounded-md border p-12 print:max-w-none print:border-0 print:p-0'>
					<PurchaseOrderDocument order={order.data} profile={profile.data} />
				</div>
			) : null}
		</div>
	);
}
