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
import { recordGatewaySettlement, toMinor, type TCashBankAccount } from '@/lib/finance-api';

const NONE = 'none';

/** Records a payment-gateway payout: net to a bank account, fee as an expense (ERP-0139). */
export function GatewaySettlementDialog({ accounts, onClose }: { accounts: TCashBankAccount[]; onClose: () => void }) {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const [accountId, setAccountId] = useState(NONE);
	const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
	const [gross, setGross] = useState('');
	const [fee, setFee] = useState('');
	const [reference, setReference] = useState('');

	const save = useMutation({
		mutationFn: () =>
			recordGatewaySettlement({
				cashBankAccountId: accountId,
				settlementDate: date,
				grossAmount: toMinor(gross),
				feeAmount: toMinor(fee),
				reference: reference.trim(),
			}),
		onSuccess: () => {
			toast.success(t('finance:gatewaySettlement.recorded'));
			void queryClient.invalidateQueries({ queryKey: ['cash-bank-accounts'] });
			void queryClient.invalidateQueries({ queryKey: ['cash-bank-transactions'] });
			onClose();
		},
		onError: (e: Error) => toast.error(e.message),
	});
	const valid = accountId !== NONE && toMinor(gross) > toMinor(fee) && reference.trim() !== '';

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
						<DialogTitle>{t('finance:gatewaySettlement.title')}</DialogTitle>
						<DialogDescription>{t('finance:gatewaySettlement.hint')}</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor='settlement-account'>{t('finance:cashBank.title')}</FieldLabel>
						<Select value={accountId} onValueChange={(v: string | null) => setAccountId(v ?? NONE)}>
							<SelectTrigger id='settlement-account'>
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
					<Field>
						<FieldLabel htmlFor='settlement-date'>{t('finance:common.date')}</FieldLabel>
						<DatePicker value={date} onChange={setDate} />
					</Field>
					<div className='grid gap-3 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='settlement-gross'>{t('finance:gatewaySettlement.gross')}</FieldLabel>
							<MoneyInput value={gross} onValueChange={setGross} />
						</Field>
						<Field>
							<FieldLabel htmlFor='settlement-fee'>{t('finance:gatewaySettlement.fee')}</FieldLabel>
							<MoneyInput value={fee} onValueChange={setFee} />
						</Field>
					</div>
					<Field>
						<FieldLabel htmlFor='settlement-reference'>{t('finance:gatewaySettlement.reference')}</FieldLabel>
						<Input id='settlement-reference' value={reference} onChange={(event) => setReference(event.target.value)} />
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
