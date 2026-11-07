import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { toast } from '@/components/toast';
import { downloadTemplate, type TImportResult } from '@/lib/hr-api';

type TImportErrorCode =
	| 'employeeUnknown'
	| 'employeeInactive'
	| 'dateInvalid'
	| 'statusInvalid'
	| 'timeInvalid'
	| 'duplicate'
	| 'leaveDay'
	| 'amountInvalid'
	| 'salaryLocked'
	| 'netNegative';

/**
 * Uploads a filled HR template. All rows or none: when the server reports
 * problems they are listed by spreadsheet row and nothing is saved.
 */
export function ImportDialog({
	open,
	onOpenChange,
	templatePath,
	templateName,
	templateLabel,
	onImport,
	onDone,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	templatePath: string;
	templateName: string;
	templateLabel: string;
	onImport: (file: File) => Promise<TImportResult>;
	onDone: () => void;
}) {
	const { t } = useTranslation(['hr', 'common']);
	const [file, setFile] = useState<File | null>(null);
	const [result, setResult] = useState<TImportResult | null>(null);
	const [busy, setBusy] = useState(false);

	const close = (next: boolean) => {
		if (!next) {
			setFile(null);
			setResult(null);
		}
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className='sm:max-w-lg'>
				<form
					onSubmit={async (event) => {
						event.preventDefault();
						if (!file) return;
						setBusy(true);
						try {
							const outcome = await onImport(file);
							setResult(outcome);
							if (outcome.errors.length === 0) {
								toast.success(t('hr:import.done', { count: outcome.imported }));
								onDone();
								close(false);
							}
						} catch (cause) {
							toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
						} finally {
							setBusy(false);
						}
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('hr:import.title')}</DialogTitle>
						<DialogDescription>{t('hr:import.hint')}</DialogDescription>
					</DialogHeader>
					<div className='flex flex-col gap-4 py-4'>
						<Button
							type='button'
							variant='outline'
							className='self-start'
							onClick={() => void downloadTemplate(templatePath, templateName).catch(() => toast.error(t('common:error.failed')))}
						>
							{templateLabel}
						</Button>
						<Field>
							<FieldLabel htmlFor='hr-import-file'>{t('hr:import.file')}</FieldLabel>
							<Input
								id='hr-import-file'
								type='file'
								accept='.xlsx,.csv'
								required
								onChange={(event) => {
									setFile(event.target.files?.[0] ?? null);
									setResult(null);
								}}
							/>
						</Field>
						{result && result.errors.length > 0 && (
							<div className='rounded-md border border-destructive/40 p-3 text-sm' role='alert'>
								<p className='mb-2 font-medium text-destructive'>{t('hr:import.failed')}</p>
								<ul className='max-h-56 list-disc overflow-auto pl-5'>
									{result.errors.map((error, index) => (
										<li key={index}>
											{t('hr:import.row', { row: error.row })}: {t(`hr:import.error.${error.code as TImportErrorCode}`)}
											{error.value && <span className='text-muted-foreground'> ({error.value})</span>}
										</li>
									))}
								</ul>
							</div>
						)}
					</div>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={() => close(false)}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={busy || !file}>
							{t('hr:import.submit')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
