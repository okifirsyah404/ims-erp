import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Field, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { toast } from '@/components/toast';
import { updateTaxRecord, type TTaxRecord } from '@/lib/tax-api';

/**
 * Edit dialog for a draft tax record's taxable base.
 *
 * @remarks
 * Only the taxable base is editable here, matching the prompt it replaces.
 * The backend rejects edits once the record leaves `draft`; the parent only
 * offers the button on draft rows, and a late rejection surfaces as a toast.
 * The recap is a derived read, so it is invalidated alongside the list.
 */
export function TaxRecordEditDialog({
	record,
	open,
	onOpenChange,
}: {
	record: TTaxRecord | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { t } = useTranslation(['tax', 'common']);
	const queryClient = useQueryClient();

	const [taxableBase, setTaxableBase] = useState(() =>
		String((record?.taxableBase ?? 0) / 100),
	);

	const submit = useMutation({
		mutationFn: () =>
			updateTaxRecord(record!.id, {
				taxableBase: Math.round(Number(taxableBase) * 100),
			}),
		onSuccess: async () => {
			toast.success(t('tax:records.updated'));
			onOpenChange(false);
			await queryClient.invalidateQueries({ queryKey: ['tax-records'] });
			await queryClient.invalidateQueries({ queryKey: ['tax-recap'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const value = Number(taxableBase);
	const invalid =
		taxableBase === '' ||
		!Number.isFinite(value) ||
		value < 0 ||
		submit.isPending;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t('tax:records.editTitle')}</DialogTitle>
					<DialogDescription>
						<span className='font-mono'>{record?.code}</span>
						{record
							? ` — ${record.periodYear}-${String(record.periodMonth).padStart(2, '0')}`
							: null}
					</DialogDescription>
				</DialogHeader>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						if (!invalid) submit.mutate();
					}}
				>
					<Field>
						<FieldLabel>{t('tax:records.taxableBase')}</FieldLabel>
						<Input
							type='number'
							min='0'
							step='0.01'
							value={taxableBase}
							onChange={(event) => setTaxableBase(event.target.value)}
							required
						/>
					</Field>
					<DialogFooter>
						<Button
							type='button'
							variant='outline'
							onClick={() => onOpenChange(false)}
						>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={invalid}>
							{t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
