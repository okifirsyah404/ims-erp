import { MoneyInput } from '@/components/money-input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { FieldLabel } from '@/components/form/field-label';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import { toast } from '@/components/toast';
import { createBill, toMinor } from '@/lib/finance-api';
import { supplierCompaniesQueryOptions } from '@/lib/supplier-api';

const NONE = 'none';

/** Creates a draft supplier bill (F5); recording it posts the payable later. */
export function BillFormDialog({ onClose }: { onClose: () => void }) {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const [supplierCompanyId, setSupplierCompanyId] = useState(NONE);
	const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
	const [dueDate, setDueDate] = useState('');
	const [subtotal, setSubtotal] = useState('');
	const [taxTotal, setTaxTotal] = useState('');

	const suppliers = useQuery(
		supplierCompaniesQueryOptions({ status: 'active', limit: 100 }),
	);

	const create = useMutation({
		mutationFn: () =>
			createBill({
				supplierCompanyId,
				billDate,
				dueDate: dueDate || null,
				subtotal: toMinor(subtotal),
				taxTotal: toMinor(taxTotal),
			}),
		onSuccess: () => {
			toast.success(t('finance:bills.created'));
			void queryClient.invalidateQueries({ queryKey: ['bills'] });
			onClose();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const valid = supplierCompanyId !== NONE && toMinor(subtotal) > 0;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-lg'>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						if (valid) create.mutate();
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('finance:bills.create')}</DialogTitle>
						<DialogDescription>{t('finance:payables.description')}</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor='bill-supplier'>{t('finance:aging.party.supplier')}</FieldLabel>
						<Select value={supplierCompanyId} onValueChange={(value: string | null) => setSupplierCompanyId(value ?? NONE)}>
							<SelectTrigger id='bill-supplier'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>{t('finance:aging.party.supplier')}</SelectItem>
								{suppliers.data?.rows.map((row) => (
									<SelectItem key={row.id} value={row.id}>
										{row.code} — {row.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<div className='grid gap-3 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='bill-date'>{t('finance:bills.billDate')}</FieldLabel>
							<DatePicker value={billDate} onChange={setBillDate} />
						</Field>
						<Field>
							<FieldLabel htmlFor='bill-due'>{t('finance:bills.dueDate')}</FieldLabel>
							<DatePicker value={dueDate} onChange={setDueDate} />
						</Field>
						<Field>
							<FieldLabel htmlFor='bill-subtotal'>{t('finance:bills.subtotal')}</FieldLabel>
							<MoneyInput id='bill-subtotal' value={subtotal} onValueChange={setSubtotal} />
						</Field>
						<Field>
							<FieldLabel htmlFor='bill-tax'>{t('finance:bills.tax')}</FieldLabel>
							<MoneyInput id='bill-tax' value={taxTotal} onValueChange={setTaxTotal} />
						</Field>
					</div>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={!valid || create.isPending}>
							{create.isPending ? t('finance:common.creating') : t('finance:common.create')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}
