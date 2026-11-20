import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { QuotationForm } from '@/components/sales/quotation-form';
import { SectionSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { companyProfileQueryOptions } from '@/lib/company-api';
import { createQuotation } from '@/lib/quotation-api';

/** A quotation may start from a customer, or from a converted lead. */
const newQuotationSearchSchema = z.object({
	customerId: z.string().optional(),
	leadId: z.string().optional(),
});

/** `/sales/quotes/new` — a new draft quotation (SPH). */
export const Route = createFileRoute('/_authed/sales/quotes/new')({
	validateSearch: newQuotationSearchSchema,
	component: NewQuotationPage,
});

function NewQuotationPage() {
	const { t } = useTranslation(['sales', 'common']);
	const search = Route.useSearch();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);
	const profile = useQuery(companyProfileQueryOptions());

	return (
		<div className='flex flex-col gap-6'>
			<h1 className='text-2xl font-bold'>{t('sales:quotations.new')}</h1>
			{profile.isPending ? (
				<SectionSkeleton lines={6} />
			) : (
				<QuotationForm
					quotation={null}
					initialCustomerId={search.customerId}
					leadId={search.leadId}
					defaultTerms={profile.data?.defaultQuotationTerms ?? null}
					submitting={submitting}
					onCancel={() => void navigate({ to: '/sales/quotes' })}
					onSubmit={async (input) => {
						setSubmitting(true);
						try {
							const created = await createQuotation(input);
							await queryClient.invalidateQueries({ queryKey: ['sales', 'quotations'] });
							toast.success(t('sales:quotations.saved'));
							void navigate({ to: '/sales/quotes/$quotationId', params: { quotationId: created.id } });
						} catch (cause) {
							toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
						} finally {
							setSubmitting(false);
						}
					}}
				/>
			)}
		</div>
	);
}
