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
import { postCashBankMovement, toMinor, type TCashBankAccount, type TAccount } from '@/lib/finance-api';

const NONE = 'none';

/** Records a cash/bank movement (deposit or withdrawal) that posts its own journal (F3). */
export function CashBankMovementDialog({ accounts, glAccounts, onClose }: { accounts: TCashBankAccount[]; glAccounts: TAccount[]; onClose: () => void }) {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const [accountId, setAccountId] = useState(NONE);
	const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
	const [direction, setDirection] = useState<'in' | 'out'>('in');
	const [amount, setAmount] = useState('');
	const [counterpartAccountId, setCounterpartAccountId] = useState(NONE);
	const [description, setDescription] = useState('');

	const save = useMutation({
		mutationFn: () =>
			postCashBankMovement({
				cashBankAccountId: accountId,
				transactionDate: date,
				direction,
				amount: toMinor(amount),
				description: description.trim() || null,
				counterpartAccountId,
			}),
		onSuccess: () => {
			toast.success(t('finance:cashBank.movementCreated'));
			void queryClient.invalidateQueries({ queryKey: ['cash-bank-accounts'] });
			void queryClient.invalidateQueries({ queryKey: ['cash-bank-transactions'] });
			onClose();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const valid = accountId !== NONE && amount !== '' && counterpartAccountId !== NONE;
	const counterpartAccounts = glAccounts.filter((account) => account.isActive && account.isPostable && !account.code.startsWith('1-1'));

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
						<DialogTitle>{t('finance:cashBank.newMovement')}</DialogTitle>
						<DialogDescription>{t('finance:cashBank.glLinkRequired')}</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor='movement-account'>{t('finance:cashBank.title')}</FieldLabel>
						<Select value={accountId} onValueChange={(v: string | null) => setAccountId(v ?? NONE)}>
							<SelectTrigger id='movement-account'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>{t('finance:payments.cashAccount')}</SelectItem>
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
						<FieldLabel htmlFor='movement-date'>{t('finance:common.date')}</FieldLabel>
						<DatePicker value={date} onChange={setDate} />
					</Field>
					<Field>
						<FieldLabel htmlFor='movement-direction'>{t('finance:common.direction')}</FieldLabel>
						<Select value={direction} onValueChange={(v: string | null) => setDirection(v === 'out' ? 'out' : 'in')}>
							<SelectTrigger id='movement-direction'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='in'>{t('finance:cashBank.direction.in')}</SelectItem>
								<SelectItem value='out'>{t('finance:cashBank.direction.out')}</SelectItem>
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor='movement-amount'>{t('finance:common.amount')}</FieldLabel>
						<MoneyInput id='movement-amount' value={amount} onValueChange={setAmount} />
					</Field>
					<Field>
						<FieldLabel htmlFor='movement-counterpart'>{t('finance:cashBank.counterpart')}</FieldLabel>
						<Select value={counterpartAccountId} onValueChange={(v: string | null) => setCounterpartAccountId(v ?? NONE)}>
							<SelectTrigger id='movement-counterpart'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>{t('finance:cashBank.counterpart')}</SelectItem>
								{counterpartAccounts.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.code} — {account.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor='movement-description'>{t('finance:common.description')}</FieldLabel>
						<Input id='movement-description' value={description} onChange={(event) => setDescription(event.target.value)} />
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
