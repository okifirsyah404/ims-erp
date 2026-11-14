import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { NativeSelect, NativeSelectOption } from '@ims-erp/ui/components/native-select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { toast } from '@/components/toast';
import {
	COMPANY_SETTING_VALUE_TYPES,
	companySettingsQueryOptions,
	saveCompanySetting,
	type TCompanySetting,
	type TCompanySettingValueType,
} from '@/lib/company-api';

/**
 * Company-wide key/value settings (ERP-0045). Lists every setting and edits
 * one at a time; `canEdit` gates the edit action (`company:update`).
 */
export function CompanySettingsCard({
	canEdit,
	excludeGroups = [],
	groups,
	title,
	description,
	emptyText,
}: {
	canEdit: boolean;
	/** Groups shown on their own settings page instead (e.g. `document`). */
	excludeGroups?: string[];
	/** When set, only these groups are listed. */
	groups?: string[];
	/** Already-translated overrides. */
	title?: string;
	description?: string;
	emptyText?: string;
}) {
	const { t } = useTranslation(['settings', 'common']);
	const queryClient = useQueryClient();
	const { data = [], isPending, isError, error } = useQuery(companySettingsQueryOptions());
	const settings = data.filter(
		(s) =>
			!excludeGroups.includes(s.settingGroup) && (groups === undefined || groups.includes(s.settingGroup)),
	);
	const [editing, setEditing] = useState<TCompanySetting | null>(null);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{title ?? t('settings:settings.title')}</CardTitle>
				<CardDescription>{description ?? t('settings:settings.description')}</CardDescription>
			</CardHeader>
			<CardContent>
				{isPending ? null : isError ? (
					<p className='text-sm text-destructive'>{error.message}</p>
				) : settings.length === 0 ? (
					<p className='text-sm text-muted-foreground'>{emptyText ?? t('settings:settings.empty')}</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('settings:settings.group')}</TableHead>
								<TableHead>{t('settings:settings.key')}</TableHead>
								<TableHead>{t('settings:settings.valueType')}</TableHead>
								<TableHead>{t('settings:settings.value')}</TableHead>
								{canEdit && <TableHead />}
							</TableRow>
						</TableHeader>
						<TableBody>
							{settings.map((setting) => (
								<TableRow key={`${setting.settingGroup}.${setting.settingKey}`}>
									<TableCell className='font-mono text-xs'>{setting.settingGroup}</TableCell>
									<TableCell className='font-mono text-xs'>{setting.settingKey}</TableCell>
									<TableCell>{t(`settings:settings.type.${setting.valueType}`)}</TableCell>
									<TableCell className='font-mono'>{setting.value ?? '—'}</TableCell>
									{canEdit && (
										<TableCell className='text-right'>
											<Button variant='outline' size='sm' onClick={() => setEditing(setting)}>
												{t('settings:settings.edit')}
											</Button>
										</TableCell>
									)}
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
			{editing && (
				<SettingDialog
					setting={editing}
					onClose={() => setEditing(null)}
					onSaved={(saved) => {
						queryClient.setQueryData<TCompanySetting[]>(companySettingsQueryOptions().queryKey, (prev = []) =>
							prev.map((s) =>
								s.settingGroup === saved.settingGroup && s.settingKey === saved.settingKey ? saved : s,
							),
						);
						setEditing(null);
						toast.success(t('settings:settings.saved'));
					}}
				/>
			)}
		</Card>
	);
}

function SettingDialog({
	setting,
	onClose,
	onSaved,
}: {
	setting: TCompanySetting;
	onClose: () => void;
	onSaved: (saved: TCompanySetting) => void;
}) {
	const { t } = useTranslation(['settings', 'common']);
	const [valueType, setValueType] = useState<TCompanySettingValueType>(setting.valueType);
	const [value, setValue] = useState(setting.value ?? '');
	const [submitting, setSubmitting] = useState(false);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setSubmitting(true);
		try {
			const saved = await saveCompanySetting(setting.settingGroup, setting.settingKey, {
				valueType,
				value: value === '' ? null : value,
			});
			onSaved(saved);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className='sm:max-w-lg'>
				<form onSubmit={(event) => void submit(event)}>
					<DialogHeader>
						<DialogTitle>
							{t('settings:settings.editTitle', { key: `${setting.settingGroup}.${setting.settingKey}` })}
						</DialogTitle>
						<DialogDescription>{t('settings:settings.editDescription')}</DialogDescription>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<Field>
							<FieldLabel htmlFor='setting-type'>{t('settings:settings.valueType')}</FieldLabel>
							<NativeSelect
								id='setting-type'
								className='w-full'
								value={valueType}
								onChange={(event) => setValueType(event.target.value as TCompanySettingValueType)}
							>
								{COMPANY_SETTING_VALUE_TYPES.map((type) => (
									<NativeSelectOption key={type} value={type}>
										{t(`settings:settings.type.${type}`)}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel htmlFor='setting-value'>{t('settings:settings.value')}</FieldLabel>
							<Input
								id='setting-value'
								type='text'
								className='font-mono'
								maxLength={4000}
								value={value}
								onChange={(event) => setValue(event.target.value)}
							/>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={submitting}>
							{submitting ? t('common:action.saving') : t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
