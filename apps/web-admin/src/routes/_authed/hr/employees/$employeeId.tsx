import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { EmployeeForm } from '@/components/hr/employee-form';
import { toast } from '@/components/toast';
import { formatBusinessDate, todayBusinessDate } from '@/lib/format';
import {
	deactivateEmployee,
	employeeQueryOptions,
	leaveBalancesQueryOptions,
	reactivateEmployee,
	saveBankAccount,
	updateEmployee,
} from '@/lib/hr-api';
import { usePermission } from '@/lib/use-permission';

/** `/hr/employees/$employeeId` — one employee: data, bank account, leave balance. */
export const Route = createFileRoute('/_authed/hr/employees/$employeeId')({
	component: EmployeeDetailPage,
});

function EmployeeDetailPage() {
	const { t, i18n } = useTranslation(['hr', 'common']);
	const { employeeId } = Route.useParams();
	const queryClient = useQueryClient();
	const canUpdate = usePermission('employee.update');
	const canArchive = usePermission('employee.archive');
	const canReadPrivate = usePermission('employee.read_private');
	const canReadLeave = usePermission('leave.read');
	const year = Number(todayBusinessDate().slice(0, 4));
	const { data, isPending, isError, error } = useQuery(employeeQueryOptions(employeeId));
	const balances = useQuery({ ...leaveBalancesQueryOptions(employeeId, year), enabled: canReadLeave });
	const [editing, setEditing] = useState(false);
	const [leaving, setLeaving] = useState(false);
	const [inactiveSince, setInactiveSince] = useState(todayBusinessDate());
	const [bank, setBank] = useState<{ bankName: string; accountNumber: string; accountHolder: string } | null>(null);
	const [busy, setBusy] = useState(false);

	if (isPending) return null;
	if (isError) {
		return (
			<div className='flex flex-col gap-4 p-6'>
				<p className='text-sm text-destructive'>{error.message}</p>
				<Link to='/hr/employees' className='text-sm hover:underline'>
					{t('hr:employees.back')}
				</Link>
			</div>
		);
	}

	const run = async (work: () => Promise<unknown>, done: string) => {
		setBusy(true);
		try {
			await work();
			await queryClient.invalidateQueries({ queryKey: ['hr'] });
			toast.success(done);
			return true;
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
			return false;
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className='flex flex-col gap-6 p-6'>
			<Link to='/hr/employees' className='text-sm text-muted-foreground hover:underline'>
				{t('hr:employees.back')}
			</Link>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>{data.fullName}</h1>
					<p className='text-sm text-muted-foreground'>
						{data.employeeCode}
						{data.position ? ` · ${data.position}` : ''}
					</p>
					<div className='mt-2 flex gap-2'>
						<Badge variant={data.employmentStatus === 'active' ? 'default' : 'outline'}>
							{t(`hr:employmentStatus.${data.employmentStatus}`)}
						</Badge>
						{data.inactiveSince && (
							<span className='text-sm text-muted-foreground'>
								{t('hr:employees.inactiveSince')} {formatBusinessDate(data.inactiveSince, i18n.language)}
							</span>
						)}
					</div>
				</div>
				<div className='flex flex-wrap gap-2'>
					{canUpdate && !editing && (
						<Button variant='outline' onClick={() => setEditing(true)}>
							{t('hr:employees.edit')}
						</Button>
					)}
					{canArchive && data.employmentStatus === 'active' && (
						<Button variant='destructive' onClick={() => setLeaving(true)}>
							{t('hr:employees.deactivate')}
						</Button>
					)}
					{canArchive && data.employmentStatus === 'inactive' && (
						<Button disabled={busy} onClick={() => void run(() => reactivateEmployee(employeeId), t('hr:employees.reactivated'))}>
							{t('hr:employees.reactivate')}
						</Button>
					)}
				</div>
			</div>

			{editing ? (
				<EmployeeForm
					initial={data}
					canReadPrivate={canReadPrivate}
					submitLabel={t('hr:employees.submit')}
					onCancel={() => setEditing(false)}
					onSubmit={async (input) => {
						if (await run(() => updateEmployee(employeeId, input), t('hr:employees.saved'))) setEditing(false);
					}}
				/>
			) : (
				<Card>
					<CardContent className='grid gap-3 pt-6 text-sm sm:grid-cols-3'>
						<Detail label={t('hr:field.nik')}>{data.nationalId}</Detail>
						<Detail label={t('hr:field.hireDate')}>{formatBusinessDate(data.hireDate, i18n.language)}</Detail>
						<Detail label={t('hr:field.baseSalary')}>
							{data.baseSalary === null
								? t('hr:employees.salaryHidden')
								: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(data.baseSalary / 100)}
						</Detail>
						<Detail label={t('hr:field.email')}>{data.email}</Detail>
						<Detail label={t('hr:field.phone')}>{data.phone}</Detail>
						<Detail label={t('hr:employees.login')}>{data.login ? `${data.login.name} (${data.login.email})` : null}</Detail>
						<Detail label={t('hr:field.notes')}>{data.notes}</Detail>
					</CardContent>
				</Card>
			)}
			{data.masked && <p className='text-xs text-muted-foreground'>{t('hr:employees.masked')}</p>}

			<div className='grid gap-6 lg:grid-cols-2'>
				<Card>
					<CardHeader className='flex flex-row items-center justify-between gap-2'>
						<CardTitle>{t('hr:bank.title')}</CardTitle>
						{canUpdate && canReadPrivate && !bank && (
							<Button
								size='sm'
								variant='outline'
								onClick={() =>
									setBank({
										bankName: data.bankAccount?.bankName ?? '',
										accountNumber: data.bankAccount?.accountNumber ?? '',
										accountHolder: data.bankAccount?.accountHolder ?? data.fullName,
									})
								}
							>
								{t('hr:bank.edit')}
							</Button>
						)}
					</CardHeader>
					<CardContent className='text-sm'>
						{bank ? (
							<form
								onSubmit={async (event) => {
									event.preventDefault();
									if (await run(() => saveBankAccount(employeeId, bank), t('hr:bank.saved'))) setBank(null);
								}}
							>
								<FieldGroup className='grid gap-3'>
									<Field>
										<FieldLabel htmlFor='bank-name'>{t('hr:bank.name')}</FieldLabel>
										<Input id='bank-name' required maxLength={100} value={bank.bankName} onChange={(event) => setBank({ ...bank, bankName: event.target.value })} />
									</Field>
									<Field>
										<FieldLabel htmlFor='bank-number'>{t('hr:bank.number')}</FieldLabel>
										<Input
											id='bank-number'
											required
											inputMode='numeric'
											maxLength={50}
											value={bank.accountNumber}
											onChange={(event) => setBank({ ...bank, accountNumber: event.target.value.replace(/[^0-9 -]/g, '') })}
										/>
									</Field>
									<Field>
										<FieldLabel htmlFor='bank-holder'>{t('hr:bank.holder')}</FieldLabel>
										<Input id='bank-holder' required maxLength={200} value={bank.accountHolder} onChange={(event) => setBank({ ...bank, accountHolder: event.target.value })} />
									</Field>
								</FieldGroup>
								<div className='mt-4 flex justify-end gap-2'>
									<Button type='button' variant='outline' onClick={() => setBank(null)}>
										{t('common:action.cancel')}
									</Button>
									<Button type='submit' disabled={busy}>
										{t('hr:bank.save')}
									</Button>
								</div>
							</form>
						) : data.bankAccount ? (
							<div className='grid gap-2 sm:grid-cols-3'>
								<Detail label={t('hr:bank.name')}>{data.bankAccount.bankName}</Detail>
								<Detail label={t('hr:bank.number')}>
									<span className='font-mono'>{data.bankAccount.accountNumber}</span>
								</Detail>
								<Detail label={t('hr:bank.holder')}>{data.bankAccount.accountHolder}</Detail>
							</div>
						) : (
							<p className='text-muted-foreground'>{t('hr:bank.none')}</p>
						)}
					</CardContent>
				</Card>

				{canReadLeave && (
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
				)}
			</div>

			<Dialog open={leaving} onOpenChange={setLeaving}>
				<DialogContent>
					<form
						onSubmit={async (event) => {
							event.preventDefault();
							if (await run(() => deactivateEmployee(employeeId, inactiveSince), t('hr:employees.deactivated'))) setLeaving(false);
						}}
					>
						<DialogHeader>
							<DialogTitle>{t('hr:employees.deactivate')}</DialogTitle>
						</DialogHeader>
						<Field className='py-4'>
							<FieldLabel htmlFor='inactive-since'>{t('hr:employees.inactiveSince')}</FieldLabel>
							<Input id='inactive-since' type='date' required value={inactiveSince} onChange={(event) => setInactiveSince(event.target.value)} />
						</Field>
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setLeaving(false)}>
								{t('common:action.cancel')}
							</Button>
							<Button type='submit' variant='destructive' disabled={busy || !inactiveSince}>
								{t('hr:employees.deactivate')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
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
