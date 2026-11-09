import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { WarrantyDocument } from '@/components/projects/warranty-document';
import { companyProfileQueryOptions } from '@/lib/company-settings-api';
import { warrantyQueryOptions } from '@/lib/handover-api';

/** `/projects/$projectId/warranty/print` — the printable warranty certificate. */
export const Route = createFileRoute('/_authed/projects/$projectId/warranty/print')({
	component: PrintWarrantyPage,
});

function PrintWarrantyPage() {
	const { t } = useTranslation(['projects', 'common']);
	const { projectId } = Route.useParams();
	const warranty = useQuery(warrantyQueryOptions(projectId));
	const profile = useQuery(companyProfileQueryOptions());

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex justify-between gap-2 print:hidden'>
				<Button variant='outline' render={<Link to='/projects/$projectId' params={{ projectId }} />} nativeButton={false}>
					{t('projects:documents.backToProject')}
				</Button>
				<Button onClick={() => window.print()} disabled={!warranty.data}>
					{t('projects:documents.print')}
				</Button>
			</div>
			{warranty.isError ? (
				<p className='text-sm text-destructive'>{warranty.error.message}</p>
			) : warranty.data && !profile.isPending ? (
				<div className='mx-auto w-full max-w-4xl rounded-md border p-12 print:max-w-none print:border-0 print:p-0'>
					<WarrantyDocument warranty={warranty.data} profile={profile.data} />
				</div>
			) : warranty.data === null ? (
				<p className='text-sm text-muted-foreground'>{t('projects:warranty.none')}</p>
			) : null}
		</div>
	);
}
