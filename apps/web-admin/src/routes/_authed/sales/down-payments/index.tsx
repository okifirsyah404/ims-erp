import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { InvoiceList } from '@/components/finance/invoice-list';

/** `/sales/down-payments` — DP invoices: the first billing term of each deal. */
export const Route = createFileRoute('/_authed/sales/down-payments/')({
	component: DownPaymentsPage,
});

function DownPaymentsPage() {
	const { t } = useTranslation('finance');
	return (
		<InvoiceList title={t('downPayments.title')} description={t('downPayments.description')} termKind='down_payment' />
	);
}
