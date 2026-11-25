import { MoneyInput } from '@/components/money-input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { FieldLabel } from '@/components/form/field-label';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import { toast } from '@/components/toast';
import { payTax, TAX_PAYMENT_ROLES, type TCashBankAccount, type TTaxPaymentRole, toMinor } from '@/lib/finance-api';

const NONE = 'none';

/** Pays a tax liability (Utang PPN / PPh) from a cash or bank account (ERP-0140). */
export function TaxPaymentDialog({ accounts, onClose }: { accounts: TCashBankAccount[]; onClose: () => void }) {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const [role, setRole] = useState<TTaxPaymentRole>('vat_payable');
	const [taxCode, setTaxCode] = useState('');
	const [accountId, setAccountId] = useState(NONE);
	const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
	const [amount, setAmount] = useState('');
	const [reference, setReference] = useState('');
	const save = useMutation({
		mutationFn: () =>
			payTax({
				role,
				taxCode: role === 'wht_payable' ? taxCode.trim() || null : null,
				cashBankAccountId: accountId,
				paymentDate: date,
				amount: toMinor(amount),
				reference: reference.trim(),
			}),
		onSuccess: () => {
			toast.success(t('finance:taxPayment.recorded'));
			void queryClient.invalidateQueries({ queryKey: ['cash-bank-accounts'] });
			void queryClient.invalidateQueries({ queryKey: ['cash-bank-transactions'] });
			onClose();
		},
		onError: (e: Error) => toast.error(e.message),
	});
	const valid = accountId !== NONE && toMinor(amount) > 0 && reference.trim() !== '';
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-lg'>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						if (valid) save.mutate();
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('finance:taxPayment.title')}</DialogTitle>
						<DialogDescription>{t('finance:taxPayment.hint')}</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor='tax-role'>{t('finance:taxPayment.liability')}</FieldLabel>
						<Select value={role} onValueChange={(value: string | null) => value && setRole(value as TTaxPaymentRole)}>
							<SelectTrigger id='tax-role'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TAX_PAYMENT_ROLES.map((value) => (
									<SelectItem key={value} value={value}>
										{t(`finance:postingRules.role.${value}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					{role === 'wht_payable' ? (
						<Field>
							<FieldLabel htmlFor='tax-code'>{t('finance:taxPayment.taxCode')}</FieldLabel>
							<Input id='tax-code' placeholder='PPH23' value={taxCode} onChange={(event) => setTaxCode(event.target.value)} />
						</Field>
					) : null}
					<Field>
						<FieldLabel htmlFor='tax-account'>{t('finance:cashBank.title')}</FieldLabel>
						<Select value={accountId} onValueChange={(v: string | null) => setAccountId(v ?? NONE)}>
							<SelectTrigger id='tax-account'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>{t('finance:common.none')}</SelectItem>
								{accounts
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
							<FieldLabel htmlFor='tax-date'>{t('finance:common.date')}</FieldLabel>
							<DatePicker value={date} onChange={setDate} />
						</Field>
						<Field>
							<FieldLabel htmlFor='tax-amount'>{t('finance:common.amount')}</FieldLabel>
							<MoneyInput value={amount} onValueChange={setAmount} />
						</Field>
					</div>
					<Field>
						<FieldLabel htmlFor='tax-reference'>{t('finance:taxPayment.reference')}</FieldLabel>
						<Input id='tax-reference' value={reference} onChange={(event) => setReference(event.target.value)} />
					</Field>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={!valid || save.isPending}>
							{save.isPending ? t('common:action.saving') : t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}
