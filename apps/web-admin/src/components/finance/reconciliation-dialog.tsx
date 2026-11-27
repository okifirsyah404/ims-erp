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
	createReconciliation,
	toMinor,
	type TCashBankAccount,
} from '@/lib/finance-api';

const NONE = 'none';

/** Opens a bank reconciliation for one cash/bank account and statement balance. */
export function ReconciliationDialog({
	accounts,
	onClose,
}: {
	accounts: TCashBankAccount[];
	onClose: () => void;
}) {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const [accountId, setAccountId] = useState(NONE);
	const [reconciliationDate, setReconciliationDate] = useState(
		() => new Date().toISOString().slice(0, 10),
	);
	const [statementBalance, setStatementBalance] = useState('');

	const create = useMutation({
		mutationFn: () =>
			createReconciliation({
				cashBankAccountId: accountId,
				reconciliationDate,
				statementBalance: toMinor(statementBalance),
			}),
		onSuccess: () => {
			toast.success(t('finance:reconciliation.created'));
			void queryClient.invalidateQueries({ queryKey: ['reconciliations'] });
			onClose();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const valid = accountId !== NONE && statementBalance.trim() !== '';

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
						<DialogTitle>{t('finance:reconciliation.create')}</DialogTitle>
						<DialogDescription>{t('finance:reconciliation.description')}</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor='recon-account'>{t('finance:reconciliation.cashAccount')}</FieldLabel>
						<Select value={accountId} onValueChange={(value: string | null) => setAccountId(value ?? NONE)}>
							<SelectTrigger id='recon-account'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>{t('finance:reconciliation.cashAccount')}</SelectItem>
								{accounts.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.code} — {account.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor='recon-date'>{t('finance:common.date')}</FieldLabel>
						<DatePicker value={reconciliationDate} onChange={setReconciliationDate} />
					</Field>
					<Field>
						<FieldLabel htmlFor='recon-balance'>{t('finance:reconciliation.statementBalance')}</FieldLabel>
						<MoneyInput id='recon-balance' value={statementBalance} onValueChange={setStatementBalance} />
					</Field>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={!valid || create.isPending}>
							{create.isPending ? t('common:action.saving') : t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}
