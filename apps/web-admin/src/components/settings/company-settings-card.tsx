import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
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
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { EmptyState, ErrorState } from '@/components/empty-state';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { Pencil } from 'lucide-react';
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

	const columns = useMemo<
		ColumnDef<DataTableFeatures, TCompanySetting, CellData>[]
	>(() => {
		const base: ColumnDef<DataTableFeatures, TCompanySetting, CellData>[] = [
			{
				accessorKey: 'settingGroup',
				header: t('settings:settings.group'),
				meta: { cellClassName: 'font-mono text-xs' },
			},
			{
				accessorKey: 'settingKey',
				header: t('settings:settings.key'),
				meta: { cellClassName: 'font-mono text-xs' },
			},
			{
				id: 'valueType',
				header: t('settings:settings.valueType'),
				cell: ({ row }) => t(`settings:settings.type.${row.original.valueType}`),
			},
			{
				id: 'value',
				header: t('settings:settings.value'),
				meta: { cellClassName: 'font-mono' },
				cell: ({ row }) => row.original.value ?? '—',
			},
		];
		if (!canEdit) return base;
		return [
			...base,
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('common:action.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('common:action.actions')}
						actions={[
							{
								key: 'edit',
								label: t('settings:settings.edit'),
								icon: Pencil,
								onSelect: () => setEditing(row.original),
							},
						]}
					/>
				),
			},
		];
	}, [canEdit, t]);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{title ?? t('settings:settings.title')}</CardTitle>
				<CardDescription>{description ?? t('settings:settings.description')}</CardDescription>
			</CardHeader>
			<CardContent>
				{isError ? (
					<ErrorState error={error} size='sm' />
				) : !isPending && settings.length === 0 ? (
					<EmptyState title={emptyText ?? t('settings:settings.empty')} size='sm' />
				) : (
					<DataTable
						columns={columns}
						data={settings}
						loading={isPending}
						getRowId={(row) => `${row.settingGroup}.${row.settingKey}`}
						sortable
					/>
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
