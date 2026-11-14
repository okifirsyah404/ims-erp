import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@ims-erp/ui/components/alert';
import { CompanyProfileForm } from '@/components/settings/company-profile-form';
import { CompanySettingsCard } from '@/components/settings/company-settings-card';
import { toast } from '@/components/toast';
import {
	companyProfileQueryOptions,
	numberingQueryOptions,
	saveCompanyProfile,
	type TCompanyProfileInput,
} from '@/lib/company-api';
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
					<CompanySettingsCard canEdit={canEdit} excludeGroups={['document']} />
				</>
			)}
		</div>
	);
}
