import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { QuotationDocument } from '@/components/sales/quotation-document';
import { companyProfileQueryOptions } from '@/lib/company-settings-api';
import { quotationQueryOptions } from '@/lib/quotation-api';

/** `/sales/quotes/$quotationId/print` — the printable SPH. */
export const Route = createFileRoute('/_authed/sales/quotes/$quotationId/print')({
	component: PrintQuotationPage,
});

function PrintQuotationPage() {
	const { t } = useTranslation(['sales', 'common']);
	const { quotationId } = Route.useParams();
	const quotation = useQuery(quotationQueryOptions(quotationId));
	const profile = useQuery(companyProfileQueryOptions());

	return (
		<div className='flex flex-col gap-4 p-6 print:p-0'>
			<div className='flex justify-between gap-2 print:hidden'>
				<Button
					variant='outline'
					render={<Link to='/sales/quotes/$quotationId' params={{ quotationId }} />}
					nativeButton={false}
				>
					{t('sales:detail.back')}
				</Button>
				<Button onClick={() => window.print()} disabled={!quotation.data}>
					{t('sales:detail.print')}
				</Button>
			</div>
			{quotation.isError ? (
				<p className='text-sm text-destructive'>{quotation.error.message}</p>
			) : quotation.data && !profile.isPending ? (
				<div className='mx-auto w-full max-w-4xl rounded-md border p-12 print:max-w-none print:border-0 print:p-0'>
					<QuotationDocument quotation={quotation.data} profile={profile.data} />
				</div>
			) : null}
		</div>
	);
}
