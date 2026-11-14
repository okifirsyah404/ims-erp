import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { NativeSelect, NativeSelectOption } from '@ims-erp/ui/components/native-select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import {
	RESET_POLICIES,
	previewNumbering,
	type TCodeNumberSetting,
	type TResetPolicy,
} from '@/lib/company-api';

/** Waits this long after the last keystroke before asking for a preview. */
const PREVIEW_DELAY_MS = 400;

/**
 * Every numbering series with its next number; `canEdit` adds the
 * "Change" action that opens {@link NumberingDialog}.
 */
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
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>{t('settings:numbering.codeType')}</TableHead>
					<TableHead>{t('settings:numbering.pattern')}</TableHead>
					<TableHead>{t('settings:numbering.resetPolicy')}</TableHead>
					<TableHead>{t('settings:numbering.nextNumber')}</TableHead>
					{canEdit && <TableHead />}
				</TableRow>
			</TableHeader>
			<TableBody>
				{settings.map((setting) => (
					<TableRow key={setting.codeType}>
						<TableCell>
							<div className='font-medium'>
								{t(`settings:numbering.type.${setting.codeType}`)}
							</div>
							<Badge variant={setting.isDefault ? 'outline' : 'secondary'}>
								{setting.isDefault ? t('settings:numbering.default') : t('settings:numbering.custom')}
							</Badge>
						</TableCell>
						<TableCell className='font-mono text-xs'>{setting.pattern}</TableCell>
						<TableCell>{t(`settings:numbering.reset.${setting.resetPolicy}`)}</TableCell>
						<TableCell className='font-mono'>{setting.nextNumber}</TableCell>
						{canEdit && (
							<TableCell className='text-right'>
								<Button variant='outline' size='sm' onClick={() => onEdit(setting)}>
									{t('settings:numbering.edit')}
								</Button>
							</TableCell>
						)}
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

/**
 * Edits the pattern and reset policy of one series, with a live preview
 * rendered (and validated) by the server.
 */
export function NumberingDialog({
	setting,
	submitting,
	onClose,
	onSave,
}: {
	setting: TCodeNumberSetting;
	submitting: boolean;
	onClose: () => void;
	onSave: (input: { pattern: string; resetPolicy: TResetPolicy }) => void;
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
		queryKey: ['code-numbers', 'preview', setting.codeType, debounced],
		queryFn: () => previewNumbering(setting.codeType, debounced),
		enabled: debounced.pattern.trim().length > 0,
		retry: false,
	});
	const typeLabel = t(`settings:numbering.type.${setting.codeType}`);

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
								{preview.isSuccess ? preview.data : '—'}
							</span>
						</div>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={submitting || preview.isError}>
							{submitting ? t('common:action.saving') : t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
