import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
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
import { createTaxType } from '@/lib/tax-api';

/** Creates a tax type (rate + effective date) — the recap workpapers read it. */
export function TaxTypeDialog({ onClose }: { onClose: () => void }) {
	const { t } = useTranslation(['tax', 'common']);
	const queryClient = useQueryClient();
	const [code, setCode] = useState('');
	const [name, setName] = useState('');
	const [rate, setRate] = useState('');
	const [effectiveFrom, setEffectiveFrom] = useState('');

	const create = useMutation({
		mutationFn: () => createTaxType({ code, name, taxType: 'vat', rate, effectiveFrom }),
		onSuccess: () => {
			toast.success(t('tax:types.created'));
			void queryClient.invalidateQueries({ queryKey: ['tax-types'] });
			onClose();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const valid = code.trim() !== '' && name.trim() !== '' && rate.trim() !== '' && effectiveFrom !== '';

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-md'>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						if (valid) create.mutate();
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('tax:types.create')}</DialogTitle>
						<DialogDescription>{t('tax:types.description')}</DialogDescription>
					</DialogHeader>
					<div className='grid gap-3 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='tax-type-code'>{t('tax:types.code')}</FieldLabel>
							<Input id='tax-type-code' value={code} onChange={(event) => setCode(event.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor='tax-type-rate'>{t('tax:types.rate')}</FieldLabel>
							<Input id='tax-type-rate' value={rate} onChange={(event) => setRate(event.target.value)} />
						</Field>
					</div>
					<Field>
						<FieldLabel htmlFor='tax-type-name'>{t('tax:types.name')}</FieldLabel>
						<Input id='tax-type-name' value={name} onChange={(event) => setName(event.target.value)} />
					</Field>
					<Field>
						<FieldLabel htmlFor='tax-type-from'>{t('tax:types.effectiveFrom')}</FieldLabel>
						<DatePicker value={effectiveFrom} onChange={setEffectiveFrom} />
					</Field>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={!valid || create.isPending}>
							{create.isPending ? t('tax:types.creating') : t('tax:types.create')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}
