import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { ContractForm } from '@/components/licensing/contract-form';
import { toast } from '@/components/toast';
import { contractQueryOptions, updateContract } from '@/lib/license-api';

/** `/subscription/$contractId/edit` — edit a draft contract. */
export const Route = createFileRoute('/_authed/subscription/$contractId/edit')({
	component: EditContractPage,
});

function EditContractPage() {
	const { t } = useTranslation(['licensing', 'common']);
	const { contractId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data, isPending, isError, error } = useQuery(contractQueryOptions(contractId));
	const back = () => void navigate({ to: '/subscription/$contractId', params: { contractId } });

	if (isPending) return <PageSkeleton cards={1} />;
	if (isError) return <ErrorState error={error} bordered />;

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('licensing:contracts.edit')}</h1>
				<p className='text-sm text-muted-foreground'>{data.code}</p>
			</div>
			<ContractForm
				initial={data}
				submitLabel={t('licensing:contracts.submit')}
				onCancel={back}
				onSubmit={async (input) => {
					try {
						await updateContract(contractId, input);
						await queryClient.invalidateQueries({ queryKey: ['licenses'] });
						toast.success(t('licensing:contracts.saved'));
						back();
					} catch (cause) {
						toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
					}
				}}
			/>
		</div>
	);
}
