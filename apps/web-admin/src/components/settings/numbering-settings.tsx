import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { NativeSelect, NativeSelectOption } from '@ims-erp/ui/components/native-select';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { CircleAlert, Pencil } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { ErrorState } from '@/components/empty-state';
import { SectionSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import {
	codeNumberingQueryKey,
	codeNumberingQueryOptions,
	exceedsMaxLength,
	previewCodeNumber,
	RESET_POLICIES,
	saveCodeNumber,
	type TCodeNumberingSection,
	type TCodeNumberInput,
	type TCodeNumberSetting,
	type TNumberSampleContext,
	type TResetPolicy,
	usesSupplierToken,
} from '@/lib/code-numbering-api';

/** Waits this long after the last keystroke before asking for a preview. */
const PREVIEW_DELAY_MS = 400;

/**
 * One card per `<schema>.code_numberings`: every series of that module with
 * its next number. `canEdit` adds the "Change" action.
 *
 * @remarks
 * The parent renders this only for sections the caller may see, so a hidden
 * section never fires its query (UX only; the backend re-checks).
 */
export function NumberingSectionCard({
	section,
	canEdit,
}: {
	section: TCodeNumberingSection;
	canEdit: boolean;
}) {
	const { t } = useTranslation(['settings', 'common']);
	const queryClient = useQueryClient();
	const settings = useQuery(codeNumberingQueryOptions(section));
	const [editing, setEditing] = useState<TCodeNumberSetting | null>(null);
	const [submitting, setSubmitting] = useState(false);

	async function handleSave(input: TCodeNumberInput) {
		if (!editing) return;
		setSubmitting(true);
		try {
			await saveCodeNumber(section, editing.codeType, input);
			await queryClient.invalidateQueries({ queryKey: codeNumberingQueryKey(section) });
			toast.success(t('settings:numbering.saved'));
			setEditing(null);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Card data-testid={`numbering-section-${section.schema}`}>
			<CardHeader>
				<CardTitle>{t(`settings:numbering.section.${section.schema}`)}</CardTitle>
				<CardDescription className='font-mono text-xs'>{section.schema}.code_numberings</CardDescription>
			</CardHeader>
			<CardContent>
				{settings.isPending && <SectionSkeleton />}
				{settings.isError && <ErrorState error={settings.error} size='sm' />}
				{settings.isSuccess && (
					<>
						<NumberingTable settings={settings.data} canEdit={canEdit} onEdit={setEditing} />
						{/* RF-30/31 (P7-5): what the next number means before anyone relies on it. */}
						<p className='mt-3 text-xs text-muted-foreground'>{t('settings:numbering.nextNumberHelp')}</p>
					</>
				)}
			</CardContent>
			{editing && (
				<NumberingDialog
					key={editing.codeType}
					section={section}
					setting={editing}
					submitting={submitting}
					onClose={() => setEditing(null)}
					onSave={(input) => void handleSave(input)}
				/>
			)}
		</Card>
	);
}

/** The series of one section with their next number. */
export function NumberingTable({
	settings,
	canEdit,
	onEdit,
}: {
	settings: TCodeNumberSetting[];
	canEdit: boolean;
	onEdit: (setting: TCodeNumberSetting) => void;
}) {
	const { t } = useTranslation(['settings', 'common']);
	const columns = useMemo<ColumnDef<DataTableFeatures, TCodeNumberSetting, CellData>[]>(
		() => [
			{
				id: 'codeType',
				accessorFn: (setting) => setting.codeType,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t('settings:numbering.codeType')} />
				),
				cell: ({ row }) => (
					<div className='flex items-center gap-2'>
						<span className='font-medium'>{t(`settings:numbering.type.${row.original.codeType}`)}</span>
						<Badge variant={row.original.isDefault ? 'outline' : 'secondary'}>
							{row.original.isDefault
								? t('settings:numbering.default')
								: t('settings:numbering.custom')}
						</Badge>
					</div>
				),
			},
			{
				accessorKey: 'pattern',
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t('settings:numbering.pattern')} />
				),
				meta: { cellClassName: 'font-mono text-xs' },
			},
			{
				id: 'resetPolicy',
				accessorFn: (setting) => setting.resetPolicy,
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t('settings:numbering.resetPolicy')} />
				),
				cell: ({ row }) => t(`settings:numbering.reset.${row.original.resetPolicy}`),
			},
			{
				accessorKey: 'nextNumber',
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t('settings:numbering.nextNumber')} />
				),
				cell: ({ row }) => <NextNumberCell setting={row.original} />,
			},
			...(canEdit
				? [
						{
							id: 'actions',
							header: () => <span className='sr-only'>{t('common:action.actions')}</span>,
							meta: { align: 'right' as const },
							cell: ({ row }: { row: { original: TCodeNumberSetting } }) => (
								<RowActions
									label={t('common:action.actions')}
									actions={[
										{
											key: 'edit',
											label: t('settings:numbering.edit'),
											icon: Pencil,
											onSelect: () => onEdit(row.original),
										},
									]}
								/>
							),
						},
					]
				: []),
		],
		[canEdit, onEdit, t],
	);

	return (
		<DataTable columns={columns} data={settings} getRowId={(setting) => setting.codeType} />
	);
}

/**
 * The example number of a series, with the P7-5 hints: a warning when it is
 * longer than its column, and for a pattern with `{SUPPLIER}` the real
 * supplier code it was rendered with (K6).
 */
function NextNumberCell({ setting }: { setting: TCodeNumberSetting }) {
	const { t } = useTranslation('settings');
	const over = exceedsMaxLength(setting.nextNumber, setting.maxLength);
	return (
		<div className='flex flex-col gap-1'>
			<span className={over ? 'font-mono text-destructive' : 'font-mono'}>{setting.nextNumber}</span>
			{over && setting.maxLength !== null && (
				<span className='flex items-center gap-1 text-xs text-destructive'>
					<CircleAlert className='size-3' aria-hidden />
					{t('numbering.overLimit', { max: setting.maxLength })}
				</span>
			)}
			{usesSupplierToken(setting.pattern) && <SampleSupplierNote context={setting.sampleContext} />}
		</div>
	);
}

/** "Example uses supplier code X" under a PO example (K6). */
function SampleSupplierNote({ context }: { context: TNumberSampleContext | undefined }) {
	const { t } = useTranslation('settings');
	const code = context?.supplier ?? 'SUP';
	return (
		<span className='text-xs text-muted-foreground'>
			{code === 'SUP' ? t('numbering.sampleSupplierNone', { code }) : t('numbering.sampleSupplier', { code })}
		</span>
	);
}

/** The too-long warning: the FU6 wording for a PO number, generic otherwise. */
function tooLongMessage(
	t: (key: 'numbering.tooLong' | 'numbering.purchaseOrderTooLong', options: { max: number }) => string,
	setting: TCodeNumberSetting,
	max: number,
): string {
	return setting.codeType === 'purchase_order'
		? t('numbering.purchaseOrderTooLong', { max })
		: t('numbering.tooLong', { max });
}

/**
 * Edits the pattern and reset policy of one series, with a live preview
 * rendered (and validated) by the owning module's API.
 */
export function NumberingDialog({
	section,
	setting,
	submitting,
	onClose,
	onSave,
}: {
	section: TCodeNumberingSection;
	setting: TCodeNumberSetting;
	submitting: boolean;
	onClose: () => void;
	onSave: (input: TCodeNumberInput) => void;
}) {
	const { t } = useTranslation(['settings', 'common']);
	const [pattern, setPattern] = useState(setting.pattern);
	const [resetPolicy, setResetPolicy] = useState<TResetPolicy>(setting.resetPolicy);
	const [debounced, setDebounced] = useState({ pattern, resetPolicy });

	useEffect(() => {
		const timer = setTimeout(() => setDebounced({ pattern, resetPolicy }), PREVIEW_DELAY_MS);
		return () => clearTimeout(timer);
	}, [pattern, resetPolicy]);

	const preview = useQuery({
		queryKey: ['code-numberings', 'preview', section.schema, setting.codeType, debounced],
		queryFn: () => previewCodeNumber(section, setting.codeType, debounced),
		enabled: debounced.pattern.trim().length > 0,
		retry: false,
	});
	const typeLabel = t(`settings:numbering.type.${setting.codeType}`);
	const tooLong = preview.isSuccess && exceedsMaxLength(preview.data.nextNumber, setting.maxLength);

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className='sm:max-w-lg'>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						onSave({ pattern: pattern.trim(), resetPolicy });
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('settings:numbering.editTitle', { type: typeLabel })}</DialogTitle>
						<DialogDescription>{t('settings:numbering.description')}</DialogDescription>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<Field data-invalid={preview.isError || undefined}>
							<FieldLabel htmlFor='numbering-pattern'>{t('settings:numbering.pattern')}</FieldLabel>
							<Input
								id='numbering-pattern'
								type='text'
								className='font-mono'
								required
								maxLength={100}
								value={pattern}
								onChange={(event) => setPattern(event.target.value)}
								aria-invalid={preview.isError}
							/>
							<FieldDescription>{t('settings:numbering.tokensHelp')}</FieldDescription>
							{preview.isError && <FieldError>{preview.error.message}</FieldError>}
						</Field>
						<Field>
							<FieldLabel htmlFor='numbering-reset'>{t('settings:numbering.resetPolicy')}</FieldLabel>
							<NativeSelect
								id='numbering-reset'
								className='w-full'
								value={resetPolicy}
								onChange={(event) => setResetPolicy(event.target.value as TResetPolicy)}
							>
								{RESET_POLICIES.map((policy) => (
									<NativeSelectOption key={policy} value={policy}>
										{t(`settings:numbering.reset.${policy}`)}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<div className='rounded-md border bg-muted/40 px-3 py-2 text-sm'>
							<span className='text-muted-foreground'>{t('settings:numbering.preview')}: </span>
							<span className='font-mono' aria-live='polite'>
								{preview.isSuccess ? preview.data.nextNumber : '-'}
							</span>
							{preview.isSuccess && usesSupplierToken(debounced.pattern) && (
								<div>
									<SampleSupplierNote context={preview.data.sampleContext} />
								</div>
							)}
						</div>
						{tooLong && setting.maxLength !== null && (
							<p className='text-sm text-destructive' role='alert'>
								{tooLongMessage((key, options) => t(`settings:${key}`, options), setting, setting.maxLength)}
							</p>
						)}
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={submitting || preview.isError || tooLong}>
							{submitting ? t('common:action.saving') : t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
