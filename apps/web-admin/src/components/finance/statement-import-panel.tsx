import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Wand2 } from 'lucide-react';

import { Button } from '@ims-erp/ui/components/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { FieldLabel } from '@/components/form/field-label';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import { toast } from '@/components/toast';
import {
	autoMatchReconciliation,
	importBankStatement,
	saveStatementMapping,
	STATEMENT_AMOUNT_MODES,
	STATEMENT_DATE_FORMATS,
	type TStatementMapping,
} from '@/lib/finance-api';

const DEFAULT_MAPPING: TStatementMapping = {
	delimiter: ',',
	skipRows: 1,
	dateColumn: 1,
	dateFormat: 'DD/MM/YYYY',
	descriptionColumn: 2,
	referenceColumn: null,
	amountMode: 'indicator',
	amountColumn: 4,
	debitColumn: null,
	creditColumn: null,
	indicatorColumn: 5,
	creditIndicator: 'CR',
	decimalSeparator: ',',
};

/**
 * Statement CSV mapping, import and auto-match for one reconciliation
 * (ERP-0143). Lines that stay unmatched are matched by hand or booked as a
 * cash/bank transaction from the line list.
 */
export function StatementImportPanel({
	reconciliationId,
	cashBankAccountId,
	mapping,
}: {
	reconciliationId: string;
	cashBankAccountId: string;
	mapping: TStatementMapping | null;
}) {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const input = useRef<HTMLInputElement>(null);
	const [mappingOpen, setMappingOpen] = useState(false);
	const invalidate = () => queryClient.invalidateQueries({ queryKey: ['reconciliations'] });

	const upload = useMutation({
		mutationFn: (file: File) => importBankStatement(reconciliationId, file),
		onSuccess: (result) => {
			if (result.errors.length > 0) {
				toast.error(
					t('finance:statement.importRejected', {
						rows: result.errors
							.slice(0, 5)
							.map((error) => error.row)
							.join(', '),
					}),
				);
				return;
			}
			toast.success(t('finance:statement.imported', { imported: result.imported, skipped: result.skipped }));
			void invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
		onSettled: () => {
			if (input.current) input.current.value = '';
		},
	});
	const autoMatch = useMutation({
		mutationFn: () => autoMatchReconciliation(reconciliationId),
		onSuccess: (result) => {
			toast.success(t('finance:statement.autoMatched', { matched: result.matched, unmatched: result.unmatched }));
			void invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	return (
		<div className='flex flex-wrap items-center gap-2'>
			<Button size='sm' variant='outline' onClick={() => setMappingOpen(true)}>
				{t('finance:statement.mapping')}
			</Button>
			<input
				ref={input}
				type='file'
				accept='.csv,.txt,text/csv'
				className='hidden'
				onChange={(event) => {
					const file = event.target.files?.[0];
					if (file) upload.mutate(file);
				}}
			/>
			<Button size='sm' variant='outline' disabled={!mapping || upload.isPending} onClick={() => input.current?.click()}>
				<Upload className='size-4' data-icon='inline-start' />
				{t('finance:statement.import')}
			</Button>
			<Button size='sm' variant='outline' disabled={autoMatch.isPending} onClick={() => autoMatch.mutate()}>
				<Wand2 className='size-4' data-icon='inline-start' />
				{t('finance:statement.autoMatch')}
			</Button>
			{!mapping ? <span className='text-muted-foreground text-xs'>{t('finance:statement.mappingFirst')}</span> : null}
			{mappingOpen ? (
				<MappingDialog
					cashBankAccountId={cashBankAccountId}
					current={mapping ?? DEFAULT_MAPPING}
					onClose={() => setMappingOpen(false)}
				/>
			) : null}
		</div>
	);
}

function MappingDialog({ cashBankAccountId, current, onClose }: { cashBankAccountId: string; current: TStatementMapping; onClose: () => void }) {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const [draft, setDraft] = useState<TStatementMapping>(current);
	const save = useMutation({
		mutationFn: () => saveStatementMapping(cashBankAccountId, draft),
		onSuccess: () => {
			toast.success(t('finance:statement.mappingSaved'));
			void queryClient.invalidateQueries({ queryKey: ['cash-bank-accounts'] });
			onClose();
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const columnField = (key: keyof TStatementMapping, label: string, optional = false) => (
		<Field>
			<FieldLabel htmlFor={`map-${key}`}>{label}</FieldLabel>
			<Input
				id={`map-${key}`}
				inputMode='numeric'
				value={draft[key] === null ? '' : String(draft[key])}
				placeholder={optional ? t('finance:statement.none') : undefined}
				onChange={(event) => {
					const digits = event.target.value.replace(/\D/g, '');
					setDraft({ ...draft, [key]: digits === '' ? (optional ? null : 1) : Number(digits) });
				}}
			/>
		</Field>
	);
	const choice = <K extends keyof TStatementMapping>(key: K, label: string, values: readonly string[], render: (value: string) => string) => (
		<Field>
			<FieldLabel htmlFor={`map-${String(key)}`}>{label}</FieldLabel>
			<Select value={String(draft[key])} onValueChange={(value: string | null) => value && setDraft({ ...draft, [key]: value })}>
				<SelectTrigger id={`map-${String(key)}`}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{values.map((value) => (
						<SelectItem key={value} value={value}>
							{render(value)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
	const mode = draft.amountMode;
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-xl'>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate();
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('finance:statement.mapping')}</DialogTitle>
						<DialogDescription>{t('finance:statement.mappingHint')}</DialogDescription>
					</DialogHeader>
					<div className='grid gap-3 sm:grid-cols-2'>
						{choice('delimiter', t('finance:statement.delimiter'), [',', ';', '\t'], (value) => (value === '\t' ? 'Tab' : value))}
						{columnField('skipRows', t('finance:statement.skipRows'))}
						{columnField('dateColumn', t('finance:statement.dateColumn'))}
						{choice('dateFormat', t('finance:statement.dateFormat'), STATEMENT_DATE_FORMATS, (value) => value)}
						{columnField('descriptionColumn', t('finance:statement.descriptionColumn'))}
						{columnField('referenceColumn', t('finance:statement.referenceColumn'), true)}
						{choice('amountMode', t('finance:statement.amountMode'), STATEMENT_AMOUNT_MODES, (value) =>
							t(`finance:statement.amountModeValue.${value as (typeof STATEMENT_AMOUNT_MODES)[number]}`),
						)}
						{choice('decimalSeparator', t('finance:statement.decimalSeparator'), [',', '.'], (value) => value)}
						{mode !== 'split' ? columnField('amountColumn', t('finance:statement.amountColumn'), true) : null}
						{mode === 'split' ? columnField('debitColumn', t('finance:statement.debitColumn'), true) : null}
						{mode === 'split' ? columnField('creditColumn', t('finance:statement.creditColumn'), true) : null}
						{mode === 'indicator' ? columnField('indicatorColumn', t('finance:statement.indicatorColumn'), true) : null}
						{mode === 'indicator' ? (
							<Field>
								<FieldLabel htmlFor='map-credit'>{t('finance:statement.creditIndicator')}</FieldLabel>
								<Input id='map-credit' value={draft.creditIndicator} onChange={(event) => setDraft({ ...draft, creditIndicator: event.target.value })} />
							</Field>
						) : null}
					</div>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={save.isPending}>
							{t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}
