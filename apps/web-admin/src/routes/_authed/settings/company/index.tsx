import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@ims-erp/ui/components/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { DocumentImageField } from '@/components/documents/document-image-field';
import { CompanyProfileForm } from '@/components/settings/company-profile-form';
import { CompanySettingsCard } from '@/components/settings/company-settings-card';
import { toast } from '@/components/toast';
import {
	companyProfileQueryOptions,
	saveCompanyProfile,
	type TCompanyProfile,
	type TCompanyProfileInput,
} from '@/lib/company-api';
import { removeDocumentImage, uploadDocumentImage } from '@/lib/document-image-api';
import { usePermission } from '@/lib/use-permission';

/** `/settings/company` — the company profile (one for the whole company). */
export const Route = createFileRoute('/_authed/settings/company/')({
	component: CompanyProfilePage,
});

function CompanyProfilePage() {
	const { t } = useTranslation(['settings', 'common']);
	const queryClient = useQueryClient();
	const canEdit = usePermission('company.update');
	const [submitting, setSubmitting] = useState(false);
	const { data: profile, isPending, isError, error } = useQuery(companyProfileQueryOptions());

	const setProfile = (saved: TCompanyProfile) =>
		queryClient.setQueryData(companyProfileQueryOptions().queryKey, saved);

	// Image URLs are re-signed on every read; they must not re-mount the form.
	const formKey = profile ? JSON.stringify({ ...profile, logoUrl: null, signatureUrl: null }) : 'new';

	async function handleImage(kind: 'logo' | 'onboarding', action: 'upload' | 'remove', file?: File) {
		try {
			const path = kind === 'logo' ? 'logo' : 'onboarding';
			const saved =
				action === 'upload'
					? await uploadDocumentImage<TCompanyProfile>(`/companies/profile/${path}`, file!)
					: await removeDocumentImage<TCompanyProfile>(`/companies/profile/${path}`);
			setProfile(saved);
			toast.success(t('settings:companyProfile.imageSaved'));
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		}
	}

	async function handleSubmit(input: TCompanyProfileInput) {
		setSubmitting(true);
		try {
			const saved = await saveCompanyProfile(input);
			queryClient.setQueryData(companyProfileQueryOptions().queryKey, saved);
			toast.success(t('settings:companyProfile.saved'));
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('settings:companyProfile.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('settings:companyProfile.description')}</p>
			</div>
			{isPending ? null : isError ? (
				<Alert variant='destructive'>
					<AlertDescription>{error.message}</AlertDescription>
				</Alert>
			) : (
				<>
					{profile === null && (
						<Alert>
							<AlertDescription>{t('settings:companyProfile.empty')}</AlertDescription>
						</Alert>
					)}
					{!canEdit && (
						<Alert>
							<AlertDescription>{t('settings:companyProfile.readOnly')}</AlertDescription>
						</Alert>
					)}
					<CompanyProfileForm
						// Re-mount with fresh values after a save.
						key={formKey}
						profile={profile}
						readOnly={!canEdit}
						submitting={submitting}
						onSubmit={(input) => void handleSubmit(input)}
					/>
					<Card>
						<CardHeader>
							<CardTitle>{t('settings:companyProfile.section.images')}</CardTitle>
							<CardDescription>{t('settings:companyProfile.imagesHint')}</CardDescription>
						</CardHeader>
						<CardContent className='flex flex-col gap-6'>
							<DocumentImageField
								label={t('settings:companyProfile.image.logo')}
								imageUrl={profile?.logoUrl ?? null}
								disabled={!canEdit}
								onUpload={(file) => handleImage('logo', 'upload', file)}
								onRemove={() => handleImage('logo', 'remove')}
							/>
							<DocumentImageField
								label={t('settings:companyProfile.image.onboarding')}
								imageUrl={profile?.onboardingUrl ?? null}
								disabled={!canEdit}
								onUpload={(file) => handleImage('onboarding', 'upload', file)}
								onRemove={() => handleImage('onboarding', 'remove')}
							/>
						</CardContent>
					</Card>
					<CompanySettingsCard canEdit={canEdit} excludeGroups={['document']} />
				</>
			)}
		</div>
	);
}
