import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Field, FieldDescription, FieldGroup } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Switch } from '@ims-erp/ui/components/switch';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { FieldLabel } from '@/components/form/field-label';
import { PageSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { formatBusinessDate } from '@/lib/format';
import { payrollSettingsQueryOptions, savePayrollSettings, type TPayrollSettings } from '@/lib/hr-records-api';
import { useIsAppAdmin } from '@/lib/use-is-app-admin';

/**
 * `/settings/payroll` — the company-wide payday of the daily payroll draft
 * run (ERP-0120). Application administrators only; the backend enforces it
 * too (`adminOrErpGuard` with `appAdminOnly`).
 */
export const Route = createFileRoute('/_authed/settings/payroll/')({
	component: PayrollSettingsPage,
});

function PayrollSettingsPage() {
	const { t } = useTranslation(['settings', 'common']);
	const { isAppAdmin, isPending: checking } = useIsAppAdmin();
	const query = useQuery({ ...payrollSettingsQueryOptions(), enabled: isAppAdmin });

	if (checking) return <PageSkeleton cards={1} />;
	if (!isAppAdmin) {
		return (
			<div className='p-6'>
				<EmptyState title={t('settings:payroll.appAdminOnly')} bordered />
			</div>
		);
	}
	return (
		<div className='mx-auto flex max-w-2xl flex-col gap-6 p-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('settings:payroll.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('settings:payroll.description')}</p>
			</div>
			{query.isPending ? (
				<PageSkeleton cards={1} />
			) : query.isError ? (
				<ErrorState error={query.error} bordered />
			) : (
				<PayDayForm key={String(query.data.payDay)} current={query.data} />
			)}
		</div>
	);
}

function PayDayForm({ current }: { current: TPayrollSettings }) {
	const { t, i18n } = useTranslation(['settings', 'common']);
	const queryClient = useQueryClient();
	const [enabled, setEnabled] = useState(current.payDay !== null);
	const [day, setDay] = useState(String(current.payDay ?? 25));
	const [busy, setBusy] = useState(false);
	const value = Number(day);
	const valid = !enabled || (Number.isInteger(value) && value >= 1 && value <= 31);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('settings:payroll.payDayTitle')}</CardTitle>
				<CardDescription>
					{current.nextRunDate
						? t('settings:payroll.nextRun', { date: formatBusinessDate(current.nextRunDate, i18n.language) })
						: t('settings:payroll.off')}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={async (event) => {
						event.preventDefault();
						setBusy(true);
						try {
							const saved = await savePayrollSettings({ payDay: enabled ? value : null });
							queryClient.setQueryData(payrollSettingsQueryOptions().queryKey, saved);
							toast.success(t('settings:payroll.saved'));
						} catch (cause) {
							toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
						} finally {
							setBusy(false);
						}
					}}
				>
					<FieldGroup>
						<label className='flex items-center gap-2 text-sm' htmlFor='payroll-enabled'>
							<Switch id='payroll-enabled' checked={enabled} onCheckedChange={(checked: boolean) => setEnabled(checked)} />
							{t('settings:payroll.enabled')}
						</label>
						<Field>
							<FieldLabel htmlFor='payroll-day'>{t('settings:payroll.payDay')}</FieldLabel>
							<Input
								id='payroll-day'
								className='w-28'
								inputMode='numeric'
								maxLength={2}
								disabled={!enabled}
								value={day}
								onChange={(event) => setDay(event.target.value.replace(/\D/g, ''))}
							/>
							<FieldDescription>{t('settings:payroll.payDayHint')}</FieldDescription>
						</Field>
						<p className='text-sm text-muted-foreground'>{t('settings:payroll.runHint')}</p>
						<div>
							<Button type='submit' disabled={busy || !valid}>
								{t('common:action.save')}
							</Button>
						</div>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
