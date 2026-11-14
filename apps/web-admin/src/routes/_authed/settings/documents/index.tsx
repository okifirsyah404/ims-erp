import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { DocumentImageField } from '@/components/documents/document-image-field';
import { CompanySettingsCard } from '@/components/settings/company-settings-card';
import { toast } from '@/components/toast';
import { companyProfileQueryOptions, type TCompanyProfile } from '@/lib/company-api';
import { removeDocumentImage, uploadDocumentImage } from '@/lib/document-image-api';
import { usePermission } from '@/lib/use-permission';

/**
 * `/settings/documents` — document module settings.
 *
 * @remarks
 * Two parts: the letterhead logo printed on documents, and the `document`
 * group of `company.settings` (ERP-0045). The company signature is **not**
 * here: signatures get their own module (ERP-0048/ERP-0049). The only
 * `document.*` key in the design so far is
 * `document.signature_request_expiry_days` (ERP-0048); it appears here once it
 * has been written, because settings are edited, not created, from this page.
 */
export const Route = createFileRoute('/_authed/settings/documents/')({
	component: DocumentSettingsPage,
});

function DocumentSettingsPage() {
	const { t } = useTranslation(['settings', 'common']);
	const queryClient = useQueryClient();
	const canEdit = usePermission('company.update');
	const { data: profile } = useQuery(companyProfileQueryOptions());

	const setProfile = (saved: TCompanyProfile) =>
		queryClient.setQueryData(companyProfileQueryOptions().queryKey, saved);

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('settings:document.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('settings:document.description')}</p>
			</div>
			{profile && (
				<Card>
					<CardHeader>
						<CardTitle>{t('settings:companyProfile.section.images')}</CardTitle>
						<CardDescription>{t('settings:companyProfile.imagesHint')}</CardDescription>
					</CardHeader>
					<CardContent>
						<DocumentImageField
							label={t('settings:companyProfile.image.logo')}
							imageUrl={profile.logoUrl}
							disabled={!canEdit}
							onUpload={async (file) => {
								setProfile(await uploadDocumentImage<TCompanyProfile>('/company/profile/logo', file));
								toast.success(t('settings:companyProfile.imageSaved'));
							}}
							onRemove={async () => {
								setProfile(await removeDocumentImage<TCompanyProfile>('/company/profile/logo'));
							}}
						/>
					</CardContent>
				</Card>
			)}
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
