import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BastForm } from '@/components/projects/bast-form';
import { toast } from '@/components/toast';
import { bastQueryOptions, updateBast } from '@/lib/handover-api';

/** `/projects/$projectId/bast/$bastId` — edit a BAST while the project is active. */
export const Route = createFileRoute('/_authed/projects/$projectId/bast/$bastId/')({
	component: EditBastPage,
});

function EditBastPage() {
	const { t } = useTranslation(['projects', 'common']);
	const { projectId, bastId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const bast = useQuery(bastQueryOptions(projectId, bastId));
	const [busy, setBusy] = useState(false);

	return (
		<div className='flex flex-col gap-6'>
			<h1 className='text-2xl font-bold'>{bast.data ? t('projects:bast.edit', { code: bast.data.code }) : ''}</h1>
			{bast.isError ? (
				<p className='text-sm text-destructive'>{bast.error.message}</p>
			) : bast.data ? (
				<BastForm
					initial={bast.data}
					submitLabel={t('projects:detail.save')}
					busy={busy}
					onCancel={() => void navigate({ to: '/projects/$projectId', params: { projectId } })}
					onSubmit={async (input) => {
						setBusy(true);
						try {
							await updateBast(projectId, bastId, input);
							await queryClient.invalidateQueries({ queryKey: ['projects'] });
							toast.success(t('projects:bast.saved'));
							void navigate({ to: '/projects/$projectId/bast/$bastId/print', params: { projectId, bastId } });
						} catch (cause) {
							toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
						} finally {
							setBusy(false);
						}
					}}
				/>
			) : null}
		</div>
	);
}
