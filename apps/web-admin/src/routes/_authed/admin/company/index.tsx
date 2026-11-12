import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@ims-erp/ui/components/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { DocumentImageField } from '@/components/documents/document-image-field';
import { CompanyProfileForm } from '@/components/settings/company-profile-form';
import { toast } from '@/components/toast';
import {
	companyProfileQueryOptions,
	numberingQueryOptions,
	saveCompanyProfile,
	type TCompanyProfile,
	type TCompanyProfileInput,
} from '@/lib/company-api';
import { removeDocumentImage, uploadDocumentImage } from '@/lib/document-image-api';
import { usePermission } from '@/lib/use-permission';

/** `/admin/company` — the company profile (one for the whole company). */
export const Route = createFileRoute('/_authed/admin/company/')({
	component: CompanyProfilePage,
});

function CompanyProfilePage() {
	const { t } = useTranslation(['settings', 'common']);
	const queryClient = useQueryClient();
	const canEdit = usePermission('company.update');
	const [submitting, setSubmitting] = useState(false);
	const { data: profile, isPending, isError, error } = useQuery(companyProfileQueryOptions());

	const setProfile = (saved: TCompanyProfile) => queryClient.setQueryData(companyProfileQueryOptions().queryKey, saved);
	// Image URLs are re-signed on every read; they must not re-mount the form.
	const formKey = profile ? JSON.stringify({ ...profile, logoUrl: null, signatureUrl: null }) : 'new';

	async function handleSubmit(input: TCompanyProfileInput) {
		setSubmitting(true);
		try {
			const saved = await saveCompanyProfile(input);
			queryClient.setQueryData(companyProfileQueryOptions().queryKey, saved);
			// Numbers use the document code: refresh their preview too.
			await queryClient.invalidateQueries({ queryKey: numberingQueryOptions().queryKey });
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
					{profile && (
						<Card>
							<CardHeader>
								<CardTitle>{t('settings:companyProfile.section.images')}</CardTitle>
								<CardDescription>{t('settings:companyProfile.imagesHint')}</CardDescription>
							</CardHeader>
							<CardContent className='grid gap-6 sm:grid-cols-2'>
								{(['logo', 'signature'] as const).map((kind) => (
									<DocumentImageField
										key={kind}
										label={t(`settings:companyProfile.image.${kind}`)}
										imageUrl={kind === 'logo' ? profile.logoUrl : profile.signatureUrl}
										disabled={!canEdit}
										onUpload={async (file) => {
											setProfile(await uploadDocumentImage<TCompanyProfile>(`/company/profile/${kind}`, file));
											toast.success(t('settings:companyProfile.imageSaved'));
										}}
										onRemove={async () => {
											setProfile(await removeDocumentImage<TCompanyProfile>(`/company/profile/${kind}`));
										}}
									/>
								))}
							</CardContent>
						</Card>
					)}
				</>
			)}
		</div>
	);
}
