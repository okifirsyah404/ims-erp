import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { BastDocument } from '@/components/projects/bast-document';
import { bastQueryOptions } from '@/lib/handover-api';

/** `/projects/$projectId/bast/$bastId/print` — the printable BAST. */
export const Route = createFileRoute('/_authed/projects/$projectId/bast/$bastId/print')({
	component: PrintBastPage,
});

function PrintBastPage() {
	const { t } = useTranslation(['projects', 'common']);
	const { projectId, bastId } = Route.useParams();
	const bast = useQuery(bastQueryOptions(projectId, bastId));

	return (
		<div className='flex flex-col gap-4 p-6 print:p-0'>
			<div className='flex justify-between gap-2 print:hidden'>
				<Button variant='outline' render={<Link to='/projects/$projectId' params={{ projectId }} />} nativeButton={false}>
					{t('projects:documents.backToProject')}
				</Button>
				<Button onClick={() => window.print()} disabled={!bast.data}>
					{t('projects:documents.print')}
				</Button>
			</div>
			{bast.isError ? (
				<p className='text-sm text-destructive'>{bast.error.message}</p>
			) : bast.data ? (
				<div className='mx-auto w-full max-w-4xl rounded-md border p-12 print:max-w-none print:border-0 print:p-0'>
					<BastDocument bast={bast.data} />
				</div>
			) : null}
		</div>
	);
}
