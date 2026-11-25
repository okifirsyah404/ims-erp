import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { FieldLabel } from '@/components/form/field-label';
import { MoneyInput } from '@/components/money-input';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import { toast } from '@/components/toast';
import { cashBankAccountsQueryOptions, createPayment, type TEmployeePayableType, toMinor } from '@/lib/finance-api';

/**
 * Drafts a payment to or from an employee (ERP-0144): an advance
 * disbursement, a settlement or claim pay-out, or cash returned against an
 * advance. The payment then goes through submit, approve and execute in the
 * employee payments table (maker-checker on payments is unchanged).
 */
export function EmployeePaymentDialog({
	employeeId,
	payableType,
	payableId,
	amount,
	exact,
	direction,
	title,
	onClose,
}: {
	employeeId: string;
	payableType: TEmployeePayableType;
	payableId: string;
	/** Minor units: the full amount (exact) or the most that may be allocated. */
	amount: number;
	exact: boolean;
	direction: 'out' | 'in';
	title: string;
	onClose: () => void;
}) {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const accounts = useQuery(cashBankAccountsQueryOptions());
	const [accountId, setAccountId] = useState('none');
	const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
	const [value, setValue] = useState(String(amount / 100));
	const [reference, setReference] = useState('');
	const minor = exact ? amount : toMinor(value);
	const valid = accountId !== 'none' && minor > 0 && minor <= amount;
	const save = useMutation({
		mutationFn: () =>
			createPayment({
				paymentType: direction === 'out' ? 'disbursement' : 'receipt',
				counterpartyType: 'employee',
				counterpartyId: employeeId,
				amount: minor,
				paymentMethod: 'bank_transfer',
				paymentDate: date,
				cashBankAccountId: accountId,
				referenceNumber: reference.trim() || null,
				allocations: [{ payableType, payableId, amount: minor }],
			}),
		onSuccess: () => {
			toast.success(t('finance:employeePayment.drafted'));
			void queryClient.invalidateQueries({ queryKey: ['payments'] });
			onClose();
		},
		onError: (error: Error) => toast.error(error.message),
	});
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-md'>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						if (valid) save.mutate();
					}}
				>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{t('finance:employeePayment.hint')}</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor='emp-pay-account'>{t('finance:cashBank.title')}</FieldLabel>
						<Select value={accountId} onValueChange={(next: string | null) => setAccountId(next ?? 'none')}>
							<SelectTrigger id='emp-pay-account'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='none'>{t('finance:common.none')}</SelectItem>
								{(accounts.data ?? [])
									.filter((account) => account.isActive)
									.map((account) => (
										<SelectItem key={account.id} value={account.id}>
											{account.code} — {account.name}
										</SelectItem>
									))}
							</SelectContent>
						</Select>
					</Field>
					<div className='grid gap-3 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='emp-pay-date'>{t('finance:common.date')}</FieldLabel>
							<DatePicker value={date} onChange={setDate} />
						</Field>
						<Field>
							<FieldLabel htmlFor='emp-pay-amount'>{t('finance:common.amount')}</FieldLabel>
							<MoneyInput value={exact ? String(amount / 100) : value} onValueChange={setValue} disabled={exact} />
						</Field>
					</div>
					<Field>
						<FieldLabel htmlFor='emp-pay-ref'>{t('finance:employeePayment.reference')}</FieldLabel>
						<Input id='emp-pay-ref' value={reference} onChange={(event) => setReference(event.target.value)} />
					</Field>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={!valid || save.isPending}>
							{t('finance:employeePayment.create')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}
