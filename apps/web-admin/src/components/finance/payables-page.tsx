import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { AgingTable } from '@/components/finance/aging-table';
import { BillsTable } from '@/components/finance/bills-table';
import { PaymentsTable } from '@/components/finance/payments-table';
import { apAgingQueryOptions } from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';

/** The route API for `/finance/payables` (validated search params). */
const routeApi = getRouteApi('/_authed/finance/payables/');

/** `/finance/payables` - AP aging + supplier bills + payments (F5). */
export function PayablesPage() {
	const { t } = useTranslation(['finance', 'common']);
	const navigate = routeApi.useNavigate();
	const search = routeApi.useSearch();
	const canRead = usePermission('bill.read');

	return (
		<div className='space-y-6'>
			<AgingTable
				title={t('finance:payables.title')}
				description={t('finance:payables.description')}
				partyLabel={t('finance:aging.party.supplier')}
				partyKey='supplierCompanyId'
				queryFor={apAgingQueryOptions}
				enabled={canRead}
				asOfDate={search.asOf}
				onAsOfChange={(asOf) => void navigate({ search: { asOf } })}
			/>
			<BillsTable />
			<PaymentsTable
				paymentType='supplier_payment'
				title={t('finance:payments.type.supplier_payment')}
			/>
		</div>
	);
}
