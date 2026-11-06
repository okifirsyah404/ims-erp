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
import { updateWithholding, type TWithholdingRecord } from '@/lib/tax-api';

/**
 * Edit dialog for a recorded withholding row's tax amount.
 *
 * @remarks
 * Only the tax amount is editable here, matching the prompt it replaces.
 * The backend only accepts edits while the row is `recorded`; the parent only
 * offers the button on recorded rows, and a late rejection surfaces as a toast
 * (`accounting.withholdingLocked`).
 */
export function WithholdingEditDialog({
	withholding,
	open,
	onOpenChange,
}: {
	withholding: TWithholdingRecord | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { t } = useTranslation(['tax', 'common']);
	const queryClient = useQueryClient();

	const [taxAmount, setTaxAmount] = useState(() =>
		String((withholding?.taxAmount ?? 0) / 100),
	);

	const submit = useMutation({
		mutationFn: () =>
			updateWithholding(withholding!.id, {
				taxAmount: Math.round(Number(taxAmount) * 100),
			}),
		onSuccess: async () => {
			toast.success(t('tax:withholding.updated'));
			onOpenChange(false);
			await queryClient.invalidateQueries({ queryKey: ['tax-withholding'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const value = Number(taxAmount);
	const invalid =
		taxAmount === '' ||
		!Number.isFinite(value) ||
		value < 0 ||
		submit.isPending;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t('tax:withholding.editTitle')}</DialogTitle>
					<DialogDescription>
						<span className='font-mono'>{withholding?.code}</span>
						{withholding?.counterpartyType
							? ` — ${withholding.counterpartyType}`
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
						<FieldLabel>{t('tax:withholding.taxAmount')}</FieldLabel>
						<Input
							type='number'
							min='0'
							step='0.01'
							value={taxAmount}
							onChange={(event) => setTaxAmount(event.target.value)}
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
