import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { InvoiceList } from '@/components/finance/invoice-list';

/** `/sales/invoices` — every invoice (ADR-0011 step 3d-2). */
export const Route = createFileRoute('/_authed/sales/invoices/')({
	component: InvoicesPage,
});

function InvoicesPage() {
	const { t } = useTranslation('finance');
	return <InvoiceList title={t('invoices.title')} description={t('invoices.description')} />;
}
