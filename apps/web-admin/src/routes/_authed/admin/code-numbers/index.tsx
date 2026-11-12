import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@ims-erp/ui/components/alert';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { NumberingDialog, NumberingTable } from '@/components/settings/numbering-settings';
import { toast } from '@/components/toast';
import {
	companyProfileQueryOptions,
	numberingQueryOptions,
	saveNumbering,
	type TCodeNumberSetting,
	type TResetPolicy,
} from '@/lib/company-api';
import { usePermission } from '@/lib/use-permission';

/** `/admin/code-numbers` — number formats per code type. */
export const Route = createFileRoute('/_authed/admin/code-numbers/')({
	component: NumberingPage,
});

function NumberingPage() {
	const { t } = useTranslation(['settings', 'common']);
	const queryClient = useQueryClient();
	const canRead = usePermission('code_number.read');
	const canEdit = usePermission('code_number.update');
	const [editing, setEditing] = useState<TCodeNumberSetting | null>(null);
	const [submitting, setSubmitting] = useState(false);
	// Numbers need the profile's document code; say so instead of an error.
	const profile = useQuery({ ...companyProfileQueryOptions(), enabled: canRead });
	const hasProfile = profile.isSuccess && profile.data !== null;
	const settings = useQuery({ ...numberingQueryOptions(), enabled: canRead && hasProfile });

	async function handleSave(input: { pattern: string; resetPolicy: TResetPolicy }) {
		if (!editing) return;
		setSubmitting(true);
		try {
			await saveNumbering(editing.codeType, input);
			await queryClient.invalidateQueries({ queryKey: numberingQueryOptions().queryKey });
			toast.success(t('settings:numbering.saved'));
			setEditing(null);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('settings:numbering.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('settings:numbering.description')}</p>
			</div>
			{profile.isSuccess && profile.data === null && (
				<Alert>
					<AlertDescription>
						<Link to='/admin/company' className='underline'>
							{t('settings:numbering.profileNeeded')}
						</Link>
					</AlertDescription>
				</Alert>
			)}
			{settings.isError && (
				<Alert variant='destructive'>
					<AlertDescription>{settings.error.message}</AlertDescription>
				</Alert>
			)}
			{settings.isSuccess && (
				<Card>
					<CardContent>
						<NumberingTable settings={settings.data} canEdit={canEdit} onEdit={setEditing} />
					</CardContent>
				</Card>
			)}
			{editing && (
				<NumberingDialog
					key={editing.codeType}
					setting={editing}
					submitting={submitting}
					onClose={() => setEditing(null)}
					onSave={(input) => void handleSave(input)}
				/>
			)}
		</div>
	);
}
