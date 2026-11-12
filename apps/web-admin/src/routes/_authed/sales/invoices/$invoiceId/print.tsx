import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { InvoiceDocument } from '@/components/finance/invoice-document';
import { companyProfileQueryOptions } from '@/lib/company-api';
import { invoiceQueryOptions } from '@/lib/invoice-api';

/** `/sales/invoices/$invoiceId/print` — the printable invoice. */
export const Route = createFileRoute('/_authed/sales/invoices/$invoiceId/print')({
	component: PrintInvoicePage,
});

function PrintInvoicePage() {
	const { t } = useTranslation(['finance', 'common']);
	const { invoiceId } = Route.useParams();
	const invoice = useQuery(invoiceQueryOptions(invoiceId));
	const profile = useQuery(companyProfileQueryOptions());

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex justify-between gap-2 print:hidden'>
				<Button
					variant='outline'
					render={<Link to='/sales/invoices/$invoiceId' params={{ invoiceId }} />}
					nativeButton={false}
				>
					{t('finance:invoices.backToInvoice')}
				</Button>
				<Button onClick={() => window.print()} disabled={!invoice.data}>
					{t('finance:invoice.print')}
				</Button>
			</div>
			{invoice.isError ? (
				<p className='text-sm text-destructive'>{invoice.error.message}</p>
			) : invoice.data && !profile.isPending ? (
				<div className='mx-auto w-full max-w-4xl rounded-md border p-12 print:max-w-none print:border-0 print:p-0'>
					<InvoiceDocument invoice={invoice.data} profile={profile.data} />
				</div>
			) : null}
		</div>
	);
}
