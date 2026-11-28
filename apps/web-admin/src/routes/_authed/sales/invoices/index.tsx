import { createFileRoute, Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { InvoiceList } from '@/components/finance/invoice-list';
import { Can } from '@/lib/use-permission';

/** `/sales/invoices` — every invoice (ADR-0011 step 3d-2), plus invoices without a sales order (B-42). */
export const Route = createFileRoute('/_authed/sales/invoices/')({
	component: InvoicesPage,
});

function InvoicesPage() {
	const { t } = useTranslation(['finance', 'sales']);
	return (
		<InvoiceList
			title={t('finance:invoices.title')}
			description={t('finance:invoices.description')}
			actions={
				<Can permission='invoice.create'>
					<Button render={<Link to='/sales/invoices/new' />} nativeButton={false}>
						<Plus aria-hidden='true' />
						{t('sales:freeInvoice.newButton')}
					</Button>
				</Can>
			}
		/>
	);
}
