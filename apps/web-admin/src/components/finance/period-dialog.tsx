import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Dialog,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { FieldLabel } from '@/components/form/field-label';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import { toast } from '@/components/toast';
import { ensurePeriod } from '@/lib/finance-api';

/**
 * Opens (or reuses) the accounting period for one month.
 *
 * @remarks
 * ERP-0167: this is the only way a fresh environment gets a period, and every
 * goods receipt needs one. The backend `ensurePeriod` is idempotent.
 */
export function PeriodDialog({
	defaultYear,
	defaultMonth,
	onClose,
}: {
	defaultYear: number;
	defaultMonth: number;
	onClose: () => void;
}) {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const [year, setYear] = useState(String(defaultYear));
	const [month, setMonth] = useState(String(defaultMonth));

	const ensure = useMutation({
		mutationFn: () =>
			ensurePeriod(Number(year) || defaultYear, Math.min(12, Math.max(1, Number(month) || defaultMonth))),
		onSuccess: () => {
			toast.success(t('finance:periods.created'));
			void queryClient.invalidateQueries({ queryKey: ['periods'] });
			void queryClient.invalidateQueries({ queryKey: ['close-checklist'] });
			onClose();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const valid = /^\d{4}$/.test(year.trim()) && Number(month) >= 1 && Number(month) <= 12;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-sm'>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						if (valid) ensure.mutate();
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('finance:periods.create')}</DialogTitle>
						<DialogDescription>{t('finance:closing.description')}</DialogDescription>
					</DialogHeader>
					<div className='grid gap-3 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='period-year'>{t('finance:closing.year')}</FieldLabel>
							<Input
								id='period-year'
								inputMode='numeric'
								value={year}
								onChange={(event) => setYear(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='period-month'>{t('finance:closing.month')}</FieldLabel>
							<Input
								id='period-month'
								inputMode='numeric'
								value={month}
								onChange={(event) => setMonth(event.target.value)}
							/>
						</Field>
					</div>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={!valid || ensure.isPending}>
							{ensure.isPending ? t('common:action.saving') : t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}
