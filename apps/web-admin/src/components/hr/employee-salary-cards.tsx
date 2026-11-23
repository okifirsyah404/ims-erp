import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { Switch } from '@ims-erp/ui/components/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { useConfirm } from '@/components/confirm-dialog';
import { RowActions } from '@/components/data-table/row-actions';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { FieldLabel } from '@/components/form/field-label';
import { MoneyInput } from '@/components/money-input';
import { SectionSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { formatBusinessDate, formatIdr, minorToRupiah, rupiahToMinor, todayBusinessDate } from '@/lib/format';
import {
	createEmployeeBankAccount,
	createSalaryPeriod,
	EMPLOYEE_ACCOUNT_TYPES,
	employeeBankAccountsQueryOptions,
	removeEmployeeBankAccount,
	removeSalaryPeriod,
	salaryPeriodsQueryOptions,
	type TEmployeeBankAccount,
	type TEmployeeBankAccountInput,
	type TSalaryPeriodRow,
	updateEmployeeBankAccount,
	updateSalaryPeriod,
} from '@/lib/hr-records-api';
import { usePermission } from '@/lib/use-permission';

/** Runs a write, refreshes `queryKey`, toasts the outcome; `true` on success. */
function useRun(queryKey: readonly unknown[]) {
	const { t } = useTranslation('common');
	const queryClient = useQueryClient();
	const [busy, setBusy] = useState(false);
	const run = async (work: () => Promise<unknown>, done: string) => {
		setBusy(true);
		try {
			await work();
			await queryClient.invalidateQueries({ queryKey });
			toast.success(done);
			return true;
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('error.failed'));
			return false;
		} finally {
			setBusy(false);
		}
	};
	return { busy, run };
}

/**
 * Salary periods of an employee (ERP-0119): base salary and fixed allowances
 * per effective period. A new period closes the current one; only the
 * active period is edited and only the latest is deleted (the server
 * enforces both). Reading `payroll.read`; a new period `payroll.create`;
 * editing and deleting `payroll.update`.
 */
export function SalaryPeriodsCard({ employeeId }: { employeeId: string }) {
	const { t, i18n } = useTranslation(['hr', 'common']);
	const canCreate = usePermission('payroll.create');
	const canUpdate = usePermission('payroll.update');
	const confirm = useConfirm();
	const query = useQuery(salaryPeriodsQueryOptions(employeeId));
	const { busy, run } = useRun(['hr', 'salary-periods', employeeId]);
	/** `undefined` closed, `null` a new period, a row = editing its amounts. */
	const [editing, setEditing] = useState<TSalaryPeriodRow | null | undefined>(undefined);
	const latestId = query.data?.[0]?.id;

	return (
		<Card className='lg:col-span-2'>
			<CardHeader>
				<CardTitle>{t('hr:salaryPeriod.title')}</CardTitle>
				{canCreate && (
					<CardAction>
						<Button size='sm' variant='outline' onClick={() => setEditing(null)}>
							{t('hr:salaryPeriod.new')}
						</Button>
					</CardAction>
				)}
			</CardHeader>
			<CardContent className='text-sm'>
				{query.isPending ? (
					<SectionSkeleton lines={2} />
				) : query.isError ? (
					<ErrorState error={query.error} size='sm' />
				) : query.data.length === 0 ? (
					<EmptyState title={t('hr:salaryPeriod.none')} size='sm' />
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('hr:salaryPeriod.effective')}</TableHead>
								<TableHead className='text-right'>{t('hr:salaryPeriod.base')}</TableHead>
								<TableHead className='text-right'>{t('hr:salaryPeriod.allowances')}</TableHead>
								<TableHead>{t('hr:field.status')}</TableHead>
								<TableHead>
									<span className='sr-only'>{t('hr:salaryPeriod.actions')}</span>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{query.data.map((row) => (
								<TableRow key={row.id}>
									<TableCell className='whitespace-nowrap'>
										{formatBusinessDate(row.effectiveFrom, i18n.language)} –{' '}
										{row.effectiveTo ? formatBusinessDate(row.effectiveTo, i18n.language) : t('hr:salaryPeriod.ongoing')}
									</TableCell>
									<TableCell className='text-right tabular-nums'>{formatIdr(row.baseSalary)}</TableCell>
									<TableCell className='text-right tabular-nums'>{formatIdr(row.fixedAllowances)}</TableCell>
									<TableCell>
										<Badge variant={row.isActive ? 'default' : 'outline'}>
											{row.isActive ? t('hr:salaryPeriod.active') : t('hr:salaryPeriod.closed')}
										</Badge>
									</TableCell>
									<TableCell className='text-right'>
										<RowActions
											label={t('hr:salaryPeriod.actions')}
											disabled={busy}
											actions={[
												{
													key: 'edit',
													label: t('hr:salaryPeriod.edit'),
													icon: Pencil,
													hidden: !(canUpdate && row.isActive),
													onSelect: () => setEditing(row),
												},
												{
													key: 'delete',
													label: t('hr:salaryPeriod.delete'),
													icon: Trash2,
													destructive: true,
													hidden: !(canUpdate && row.id === latestId),
													onSelect: async () => {
														if (
															await confirm({
																title: t('hr:salaryPeriod.deleteConfirm'),
																description: t('hr:salaryPeriod.deleteConfirmDescription'),
																destructive: true,
															})
														) {
															void run(() => removeSalaryPeriod(row.id), t('hr:salaryPeriod.deleted'));
														}
													},
												},
											]}
										/>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
			{editing !== undefined && (
				<SalaryPeriodDialog key={editing?.id ?? 'new'} employeeId={employeeId} row={editing} busy={busy} run={run} onClose={() => setEditing(undefined)} />
			)}
		</Card>
	);
}

function SalaryPeriodDialog({
	employeeId,
	row,
	busy,
	run,
	onClose,
}: {
	employeeId: string;
	row: TSalaryPeriodRow | null;
	busy: boolean;
	run: (work: () => Promise<unknown>, done: string) => Promise<boolean>;
	onClose: () => void;
}) {
	const { t } = useTranslation(['hr', 'common']);
	const [effectiveFrom, setEffectiveFrom] = useState(row?.effectiveFrom ?? todayBusinessDate());
	const [base, setBase] = useState(row ? minorToRupiah(row.baseSalary) : '');
	const [allowances, setAllowances] = useState(row ? minorToRupiah(row.fixedAllowances) : '0');

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent>
				<form
					onSubmit={async (event) => {
						event.preventDefault();
						const amounts = { baseSalary: rupiahToMinor(base), fixedAllowances: rupiahToMinor(allowances) };
						const done = await run(
							() => (row ? updateSalaryPeriod(row.id, amounts) : createSalaryPeriod(employeeId, { effectiveFrom, ...amounts })),
							row ? t('hr:salaryPeriod.updated') : t('hr:salaryPeriod.created'),
						);
						if (done) onClose();
					}}
				>
					<DialogHeader>
						<DialogTitle>{row ? t('hr:salaryPeriod.edit') : t('hr:salaryPeriod.new')}</DialogTitle>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<Field>
							<FieldLabel htmlFor='period-from'>{t('hr:salaryPeriod.effectiveFrom')}</FieldLabel>
							<DatePicker id='period-from' required disabled={!!row} value={effectiveFrom} onChange={setEffectiveFrom} />
							<FieldDescription>{row ? t('hr:salaryPeriod.dateLocked') : t('hr:salaryPeriod.closesPrevious')}</FieldDescription>
						</Field>
						<div className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='period-base'>{t('hr:salaryPeriod.base')}</FieldLabel>
								<MoneyInput id='period-base' required value={base} onValueChange={setBase} />
							</Field>
							<Field>
								<FieldLabel htmlFor='period-allowances'>{t('hr:salaryPeriod.allowances')}</FieldLabel>
								<MoneyInput id='period-allowances' value={allowances} onValueChange={setAllowances} />
							</Field>
						</div>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={busy || !base || !effectiveFrom}>
							{t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/**
 * Salary payee accounts of an employee (ERP-0119). Finance owns them
 * (`/finance/employee-bank-accounts`); the number is masked without
 * `employee.read_private`. The first account is primary; making another one
 * primary moves the role. Writing needs `payroll.update`.
 */
export function BankAccountsCard({ employeeId, fullName }: { employeeId: string; fullName: string }) {
	const { t } = useTranslation(['hr', 'common']);
	const canUpdate = usePermission('payroll.update');
	const canReadPrivate = usePermission('employee.read_private');
	const canEdit = canUpdate && canReadPrivate;
	const confirm = useConfirm();
	const query = useQuery(employeeBankAccountsQueryOptions(employeeId));
	const { busy, run } = useRun(['hr', 'bank-accounts', employeeId]);
	const [editing, setEditing] = useState<TEmployeeBankAccount | null | undefined>(undefined);

	const inputOf = (row: TEmployeeBankAccount, patch: Partial<TEmployeeBankAccountInput> = {}): TEmployeeBankAccountInput => ({
		accountType: row.accountType,
		bankName: row.bankName ?? '',
		bankCode: row.bankCode,
		accountNumber: row.accountNumber ?? '',
		accountHolder: row.accountHolder ?? '',
		isPrimary: row.isPrimary,
		isActive: row.isActive,
		...patch,
	});

	return (
		<Card className='lg:col-span-2'>
			<CardHeader>
				<CardTitle>{t('hr:bank.title')}</CardTitle>
				{canEdit && (
					<CardAction>
						<Button size='sm' variant='outline' onClick={() => setEditing(null)}>
							{t('hr:bank.add')}
						</Button>
					</CardAction>
				)}
			</CardHeader>
			<CardContent className='text-sm'>
				{query.isPending ? (
					<SectionSkeleton lines={2} />
				) : query.isError ? (
					<ErrorState error={query.error} size='sm' />
				) : query.data.length === 0 ? (
					<EmptyState title={t('hr:bank.none')} size='sm' />
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('hr:bank.name')}</TableHead>
								<TableHead>{t('hr:bank.number')}</TableHead>
								<TableHead>{t('hr:bank.holder')}</TableHead>
								<TableHead>{t('hr:field.status')}</TableHead>
								<TableHead>
									<span className='sr-only'>{t('hr:bank.actions')}</span>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{query.data.map((row) => (
								<TableRow key={row.id}>
									<TableCell>
										<div>{row.bankName}</div>
										<div className='text-xs text-muted-foreground'>{t(`hr:bank.type.${row.accountType}`)}</div>
									</TableCell>
									<TableCell className='font-mono'>{row.accountNumber}</TableCell>
									<TableCell>{row.accountHolder}</TableCell>
									<TableCell className='space-x-1'>
										{row.isPrimary && <Badge>{t('hr:bank.primary')}</Badge>}
										{!row.isActive && <Badge variant='outline'>{t('hr:bank.inactive')}</Badge>}
									</TableCell>
									<TableCell className='text-right'>
										<RowActions
											label={t('hr:bank.actions')}
											disabled={busy}
											actions={[
												{
													key: 'primary',
													label: t('hr:bank.makePrimary'),
													icon: Star,
													hidden: !canEdit || row.isPrimary,
													onSelect: () =>
														void run(() => updateEmployeeBankAccount(row.id, inputOf(row, { isPrimary: true })), t('hr:bank.saved')),
												},
												{ key: 'edit', label: t('hr:bank.edit'), icon: Pencil, hidden: !canEdit, onSelect: () => setEditing(row) },
												{
													key: 'delete',
													label: t('hr:bank.delete'),
													icon: Trash2,
													destructive: true,
													hidden: !canEdit,
													onSelect: async () => {
														if (await confirm({ title: t('hr:bank.deleteConfirm'), destructive: true })) {
															void run(() => removeEmployeeBankAccount(row.id), t('hr:bank.deleted'));
														}
													},
												},
											]}
										/>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
			{editing !== undefined && (
				<BankAccountDialog
					key={editing?.id ?? 'new'}
					employeeId={employeeId}
					fullName={fullName}
					row={editing}
					busy={busy}
					run={run}
					onClose={() => setEditing(undefined)}
				/>
			)}
		</Card>
	);
}

function BankAccountDialog({
	employeeId,
	fullName,
	row,
	busy,
	run,
	onClose,
}: {
	employeeId: string;
	fullName: string;
	row: TEmployeeBankAccount | null;
	busy: boolean;
	run: (work: () => Promise<unknown>, done: string) => Promise<boolean>;
	onClose: () => void;
}) {
	const { t } = useTranslation(['hr', 'common']);
	const [draft, setDraft] = useState<TEmployeeBankAccountInput>({
		accountType: row?.accountType ?? 'bank',
		bankName: row?.bankName ?? '',
		bankCode: row?.bankCode ?? null,
		accountNumber: row?.accountNumber ?? '',
		accountHolder: row?.accountHolder ?? fullName,
		isPrimary: row?.isPrimary ?? false,
		isActive: row?.isActive ?? true,
	});
	const set = (patch: Partial<TEmployeeBankAccountInput>) => setDraft((current) => ({ ...current, ...patch }));

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent>
				<form
					onSubmit={async (event) => {
						event.preventDefault();
						const done = await run(
							() => (row ? updateEmployeeBankAccount(row.id, draft) : createEmployeeBankAccount(employeeId, draft)),
							t('hr:bank.saved'),
						);
						if (done) onClose();
					}}
				>
					<DialogHeader>
						<DialogTitle>{row ? t('hr:bank.edit') : t('hr:bank.add')}</DialogTitle>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<div className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='bank-type'>{t('hr:bank.accountType')}</FieldLabel>
								<Select value={draft.accountType} onValueChange={(value: string | null) => set({ accountType: (value ?? 'bank') as TEmployeeBankAccountInput['accountType'] })}>
									<SelectTrigger id='bank-type' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{EMPLOYEE_ACCOUNT_TYPES.map((value) => (
											<SelectItem key={value} value={value}>
												{t(`hr:bank.type.${value}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field>
								<FieldLabel htmlFor='bank-name'>{t('hr:bank.name')}</FieldLabel>
								<Input id='bank-name' required maxLength={100} value={draft.bankName} onChange={(event) => set({ bankName: event.target.value })} />
							</Field>
							<Field>
								<FieldLabel htmlFor='bank-number'>{t('hr:bank.number')}</FieldLabel>
								<Input
									id='bank-number'
									required
									inputMode='numeric'
									maxLength={50}
									value={draft.accountNumber}
									onChange={(event) => set({ accountNumber: event.target.value.replace(/[^0-9 -]/g, '') })}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='bank-holder'>{t('hr:bank.holder')}</FieldLabel>
								<Input id='bank-holder' required maxLength={200} value={draft.accountHolder} onChange={(event) => set({ accountHolder: event.target.value })} />
							</Field>
						</div>
						<label className='flex items-center gap-2 text-sm' htmlFor='bank-primary'>
							<Switch id='bank-primary' checked={draft.isPrimary} onCheckedChange={(checked: boolean) => set({ isPrimary: checked })} />
							{t('hr:bank.primaryHint')}
						</label>
						<label className='flex items-center gap-2 text-sm' htmlFor='bank-active'>
							<Switch id='bank-active' checked={draft.isActive} onCheckedChange={(checked: boolean) => set({ isActive: checked })} />
							{t('hr:bank.activeLabel')}
						</label>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={busy || !draft.bankName.trim() || draft.accountNumber.trim().length < 3 || !draft.accountHolder.trim()}>
							{t('hr:bank.save')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
