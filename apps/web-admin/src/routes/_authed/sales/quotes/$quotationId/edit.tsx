import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { QuotationForm } from '@/components/sales/quotation-form';
import { toast } from '@/components/toast';
import { quotationQueryOptions, updateQuotation } from '@/lib/quotation-api';

/** `/sales/quotes/$quotationId/edit` — edit a draft quotation. */
export const Route = createFileRoute('/_authed/sales/quotes/$quotationId/edit')({
	component: EditQuotationPage,
});

function EditQuotationPage() {
	const { t } = useTranslation(['sales', 'common']);
	const { quotationId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);
	const { data, isPending, isError, error } = useQuery(quotationQueryOptions(quotationId));
	const back = () => void navigate({ to: '/sales/quotes/$quotationId', params: { quotationId } });

	return (
		<div className='flex flex-col gap-6 p-6'>
			<h1 className='text-2xl font-bold'>
				{t('sales:quotations.edit')}
				{data ? ` ${data.code}` : ''}
			</h1>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.status !== 'draft' ? (
				<p className='text-sm text-muted-foreground'>{t('sales:detail.onlyDraftEditable')}</p>
			) : (
				<QuotationForm
					quotation={data}
					defaultTerms={null}
					submitting={submitting}
					onCancel={back}
					onSubmit={async (input) => {
						setSubmitting(true);
						try {
							await updateQuotation(quotationId, input);
							await queryClient.invalidateQueries({ queryKey: ['sales', 'quotations'] });
							toast.success(t('sales:quotations.saved'));
							back();
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
