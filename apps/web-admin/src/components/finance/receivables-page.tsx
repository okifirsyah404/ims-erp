import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { AgingTable } from '@/components/finance/aging-table';
import { PaymentsTable } from '@/components/finance/payments-table';
import { WriteOffRequests } from '@/components/finance/write-off-requests';
import { arAgingQueryOptions } from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';

/** The route API for `/finance/receivables` (validated search params). */
const routeApi = getRouteApi('/_authed/finance/receivables/');

/** `/finance/receivables` - AR aging + customer payments (F4). */
export function ReceivablesPage() {
	const { t } = useTranslation(['finance', 'common']);
	const navigate = routeApi.useNavigate();
	const search = routeApi.useSearch();
	const canRead = usePermission('payment.read');

	return (
		<div className='space-y-6'>
			<WriteOffRequests />
			<AgingTable
				title={t('finance:receivables.title')}
				description={t('finance:receivables.description')}
				partyLabel={t('finance:aging.party.customer')}
				partyKey='customerId'
				queryFor={arAgingQueryOptions}
				enabled={canRead}
				asOfDate={search.asOf}
				onAsOfChange={(asOf) => void navigate({ search: { asOf } })}
			/>
			<PaymentsTable
				paymentType='customer_payment'
				title={t('finance:payments.type.customer_payment')}
			/>
		</div>
	);
}
