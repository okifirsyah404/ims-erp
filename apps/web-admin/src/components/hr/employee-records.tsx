import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { toast } from '@/components/toast';
import { todayBusinessDate } from '@/lib/format';
import { bankAccountQueryOptions, leaveBalancesQueryOptions, saveBankAccount } from '@/lib/hr-records-api';
import { usePermission } from '@/lib/use-permission';

/**
 * M08 cards on the ERP-0034 employee page: the salary bank account (number
 * masked without `employee:read_private`; editing needs `employee:update`
 * and `:read_private`) and this year's leave balance.
 */
export function EmployeeRecordCards({ employeeId, fullName }: { employeeId: string; fullName: string }) {
	const canReadLeave = usePermission('leave.read');
	return (
		<div className='grid gap-4 lg:grid-cols-2'>
			<BankAccountCard employeeId={employeeId} fullName={fullName} />
			{canReadLeave && <LeaveBalanceCard employeeId={employeeId} />}
		</div>
	);
}

type TBankDraft = { bankName: string; accountNumber: string; accountHolder: string };

function BankAccountCard({ employeeId, fullName }: { employeeId: string; fullName: string }) {
	const { t } = useTranslation(['hr', 'common']);
	const queryClient = useQueryClient();
	const canUpdate = usePermission('employee.update');
	const canReadPrivate = usePermission('employee.read_private');
	const canEdit = canUpdate && canReadPrivate;
	const { data: account } = useQuery(bankAccountQueryOptions(employeeId));
	const [draft, setDraft] = useState<TBankDraft | null>(null);
	const [busy, setBusy] = useState(false);

	const save = async (value: TBankDraft) => {
		setBusy(true);
		try {
			await saveBankAccount(employeeId, value);
			await queryClient.invalidateQueries({ queryKey: ['hr', 'bank-account', employeeId] });
			toast.success(t('hr:bank.saved'));
			setDraft(null);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};

	return (
		<Card>
			<CardHeader className='flex flex-row items-center justify-between gap-2'>
				<CardTitle>{t('hr:bank.title')}</CardTitle>
				{canEdit && !draft && (
					<Button
						size='sm'
						variant='outline'
						onClick={() =>
							setDraft({
								bankName: account?.bankName ?? '',
								accountNumber: account?.accountNumber ?? '',
								accountHolder: account?.accountHolder ?? fullName,
							})
						}
					>
						{t('hr:bank.edit')}
					</Button>
				)}
			</CardHeader>
			<CardContent className='text-sm'>
				{draft ? (
					<form
						onSubmit={(event) => {
							event.preventDefault();
							void save(draft);
						}}
					>
						<FieldGroup className='grid gap-3'>
							<Field>
								<FieldLabel htmlFor='bank-name'>{t('hr:bank.name')}</FieldLabel>
								<Input id='bank-name' required maxLength={100} value={draft.bankName} onChange={(event) => setDraft({ ...draft, bankName: event.target.value })} />
							</Field>
							<Field>
								<FieldLabel htmlFor='bank-number'>{t('hr:bank.number')}</FieldLabel>
								<Input
									id='bank-number'
									required
									inputMode='numeric'
									maxLength={50}
									value={draft.accountNumber}
									onChange={(event) => setDraft({ ...draft, accountNumber: event.target.value.replace(/[^0-9 -]/g, '') })}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='bank-holder'>{t('hr:bank.holder')}</FieldLabel>
								<Input id='bank-holder' required maxLength={200} value={draft.accountHolder} onChange={(event) => setDraft({ ...draft, accountHolder: event.target.value })} />
							</Field>
						</FieldGroup>
						<div className='mt-4 flex justify-end gap-2'>
							<Button type='button' variant='outline' onClick={() => setDraft(null)}>
								{t('common:action.cancel')}
							</Button>
							<Button type='submit' disabled={busy}>
								{t('hr:bank.save')}
							</Button>
						</div>
					</form>
				) : account ? (
					<div className='grid gap-2 sm:grid-cols-3'>
						<Detail label={t('hr:bank.name')}>{account.bankName}</Detail>
						<Detail label={t('hr:bank.number')}>
							<span className='font-mono'>{account.accountNumber}</span>
						</Detail>
						<Detail label={t('hr:bank.holder')}>{account.accountHolder}</Detail>
					</div>
				) : (
					<p className='text-muted-foreground'>{t('hr:bank.none')}</p>
				)}
			</CardContent>
		</Card>
	);
}

function LeaveBalanceCard({ employeeId }: { employeeId: string }) {
	const { t } = useTranslation(['hr']);
	const year = Number(todayBusinessDate().slice(0, 4));
	const balances = useQuery(leaveBalancesQueryOptions(employeeId, year));
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('hr:balance.title', { year })}</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col gap-2 text-sm'>
				{(balances.data ?? []).map((balance) => (
					<div key={balance.leaveType.id}>
						<div className='font-medium'>{balance.leaveType.name}</div>
						<div className='text-muted-foreground'>
							{t('hr:balance.line', {
								remaining: balance.remaining,
								quota: balance.leaveType.annualQuotaDays,
								approved: balance.approved,
								pending: balance.pending,
							})}
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{children || '—'}</div>
		</div>
	);
}
