import { MoneyInput } from '@/components/money-input';
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
import {
	addOpeningBalanceRow,
	toMinor,
	type TAccount,
} from '@/lib/finance-api';

const NONE = 'none';

/**
 * Adds one draft opening-balance row (M09 F3).
 *
 * @remarks
 * Only postable, active accounts are offered — the batch posts as one journal
 * entry, so a non-postable account would fail at posting time. Debit and credit
 * are separate inputs because an opening balance is a single-sided figure.
 */
export function OpeningBalanceRowDialog({
	accounts,
	onClose,
}: {
	accounts: TAccount[];
	onClose: () => void;
}) {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const [accountId, setAccountId] = useState(NONE);
	const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
	const [debit, setDebit] = useState('');
	const [credit, setCredit] = useState('');

	const save = useMutation({
		mutationFn: () =>
			addOpeningBalanceRow({
				accountId,
				asOfDate,
				debitBalance: toMinor(debit),
				creditBalance: toMinor(credit),
			}),
		onSuccess: () => {
			toast.success(t('finance:opening.addRowDone'));
			void queryClient.invalidateQueries({ queryKey: ['opening-balances'] });
			onClose();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const postable = accounts.filter((account) => account.isActive && account.isPostable);
	const hasAmount = toMinor(debit) > 0 || toMinor(credit) > 0;
	const valid = accountId !== NONE && hasAmount;

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
						<DialogTitle>{t('finance:opening.addRow')}</DialogTitle>
						<DialogDescription>{t('finance:opening.description')}</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor='opening-account'>{t('finance:opening.account')}</FieldLabel>
						<Select value={accountId} onValueChange={(value: string | null) => setAccountId(value ?? NONE)}>
							<SelectTrigger id='opening-account'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>{t('finance:opening.account')}</SelectItem>
								{postable.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.code} — {account.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor='opening-as-of'>{t('finance:opening.asOf')}</FieldLabel>
						<DatePicker value={asOfDate} onChange={setAsOfDate} />
					</Field>
					<div className='grid gap-3 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='opening-debit'>{t('finance:opening.debit')}</FieldLabel>
							<MoneyInput id='opening-debit' value={debit} onValueChange={setDebit} />
						</Field>
						<Field>
							<FieldLabel htmlFor='opening-credit'>{t('finance:opening.credit')}</FieldLabel>
							<MoneyInput id='opening-credit' value={credit} onValueChange={setCredit} />
						</Field>
					</div>
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
