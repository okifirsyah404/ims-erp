import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { ContractForm } from '@/components/licensing/contract-form';
import { toast } from '@/components/toast';
import { createContract } from '@/lib/license-api';

/** `/subscription/new` — a draft license contract. */
export const Route = createFileRoute('/_authed/subscription/new')({
	component: NewContractPage,
});

function NewContractPage() {
	const { t } = useTranslation(['licensing', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('licensing:contracts.new')}</h1>
				<p className='text-sm text-muted-foreground'>{t('licensing:contracts.formHint')}</p>
			</div>
			<ContractForm
				submitLabel={t('licensing:contracts.submit')}
				onCancel={() => void navigate({ to: '/subscription' })}
				onSubmit={async (input) => {
					try {
						const created = await createContract(input);
						await queryClient.invalidateQueries({ queryKey: ['licenses'] });
						toast.success(t('licensing:contracts.created'));
						void navigate({ to: '/subscription/$contractId', params: { contractId: created.id } });
					} catch (cause) {
						toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
					}
				}}
			/>
		</div>
	);
}
