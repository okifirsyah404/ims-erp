import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BastForm } from '@/components/projects/bast-form';
import { toast } from '@/components/toast';
import { bastDraftQueryOptions, createBast } from '@/lib/handover-api';

/** `/projects/$projectId/bast/new` — a new BAST prefilled from the deal. */
export const Route = createFileRoute('/_authed/projects/$projectId/bast/new')({
	component: NewBastPage,
});

function NewBastPage() {
	const { t } = useTranslation(['projects', 'common']);
	const { projectId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const draft = useQuery(bastDraftQueryOptions(projectId));
	const [busy, setBusy] = useState(false);

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('projects:bast.new')}</h1>
				<p className='text-sm text-muted-foreground'>{t('projects:bast.newHint')}</p>
			</div>
			{draft.isError ? (
				<p className='text-sm text-destructive'>{draft.error.message}</p>
			) : draft.data ? (
				<BastForm
					initial={draft.data}
					submitLabel={t('projects:bast.issue')}
					busy={busy}
					onCancel={() => void navigate({ to: '/projects/$projectId', params: { projectId } })}
					onSubmit={async (input) => {
						setBusy(true);
						try {
							const created = await createBast(projectId, input);
							await queryClient.invalidateQueries({ queryKey: ['projects'] });
							toast.success(t('projects:bast.issued'));
							void navigate({ to: '/projects/$projectId/bast/$bastId/print', params: { projectId, bastId: created.id } });
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
