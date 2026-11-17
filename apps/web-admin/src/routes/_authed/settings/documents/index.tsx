import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next';

import { CompanySettingsCard } from '@/components/settings/company-settings-card';
import { usePermission } from '@/lib/use-permission';

/**
 * `/settings/documents` — document module settings.
 *
 * @remarks
 * Only the `document` group of `company.settings` (ERP-0045). The letterhead
 * logo and the onboarding image live on `/settings/company` (ERP-0064); the
 * company signature gets its own module (ERP-0048/ERP-0049). The only
 * `document.*` key in the design so far is
 * `document.signature_request_expiry_days` (ERP-0048); it appears here once it
 * has been written, because settings are edited, not created, from this page.
 */
export const Route = createFileRoute('/_authed/settings/documents/')({
	component: DocumentSettingsPage,
});

function DocumentSettingsPage() {
	const { t } = useTranslation(['settings', 'common']);
	const canEdit = usePermission('company.update');

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('settings:document.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('settings:document.description')}</p>
			</div>
			<CompanySettingsCard
				canEdit={canEdit}
				groups={['document']}
				title={t('settings:document.settingsTitle')}
				description={t('settings:document.settingsDescription')}
				emptyText={t('settings:document.settingsEmpty')}
			/>
		</div>
	);
}
