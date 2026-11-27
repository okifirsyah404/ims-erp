import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { FieldLabel } from '@/components/form/field-label';
import { MoneyInput } from '@/components/money-input';
import { PaymentsTable } from '@/components/finance/payments-table';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import { toast } from '@/components/toast';
import {
	accountsQueryOptions,
	advanceAction,
	advancesQueryOptions,
	createAdvance,
	createSettlement,
	settlementAction,
	settlementsQueryOptions,
	type TEmployeeAdvance,
	type TEmployeePayableType,
	type TExpenseSettlement,
	toMinor,
} from '@/lib/finance-api';
import { employeePickerQueryOptions } from '@/lib/hr-api';
import { getActiveOrganizationId } from '@/lib/organization-store';
import { usePermission } from '@/lib/use-permission';
import { EmployeePaymentDialog } from './employee-payment-dialog';

const money = (minor: number) => (minor / 100).toLocaleString('id-ID');
const today = () => new Date().toISOString().slice(0, 10);

type TPay = {
	employeeId: string;
	payableType: TEmployeePayableType;
	payableId: string;
	amount: number;
	exact: boolean;
	direction: 'out' | 'in';
	title: string;
};

/**
 * Employee advances and their settlements (ERP-0144) on the expenses page:
 * request, approve, disburse through a payment, settle with expense lines,
 * verify, approve, then pay out an excess or take back the rest.
 */
export function AdvancesPanel() {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const can = {
		readAdvance: usePermission('advance.read'),
		createAdvance: usePermission('advance.create'),
		submitAdvance: usePermission('advance.submit'),
		approveAdvance: usePermission('advance.approve'),
		rejectAdvance: usePermission('advance.reject'),
		readSettlement: usePermission('settlement.read'),
		createSettlement: usePermission('settlement.create'),
		submitSettlement: usePermission('settlement.submit'),
		verifySettlement: usePermission('settlement.verify'),
		approveSettlement: usePermission('settlement.approve'),
		rejectSettlement: usePermission('settlement.reject'),
		pay: usePermission('payment.create'),
	};
	const advances = useQuery({ ...advancesQueryOptions(), enabled: can.readAdvance });
	const settlements = useQuery({ ...settlementsQueryOptions(), enabled: can.readSettlement });
	const organizationId = getActiveOrganizationId();
	const employees = useQuery(employeePickerQueryOptions(organizationId ? [organizationId] : []));
	const employeeName = useMemo(() => new Map((employees.data ?? []).map((row) => [row.id, row.fullName])), [employees.data]);
	const [creating, setCreating] = useState(false);
	const [settling, setSettling] = useState<TEmployeeAdvance | null>(null);
	const [pay, setPay] = useState<TPay | null>(null);

	const refresh = () => queryClient.invalidateQueries({ queryKey: ['finance', 'advances'] });
	const act = useMutation({
		mutationFn: (input: { kind: 'advance' | 'settlement'; id: string; action: string }): Promise<unknown> =>
			input.kind === 'advance' ? advanceAction(input.id, input.action) : settlementAction(input.id, input.action),
		onSuccess: () => {
			toast.success(t('finance:advances.updated'));
			void refresh();
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const button = (show: boolean, label: string, onClick: () => void, variant: 'outline' | 'ghost' = 'outline') =>
		show ? (
			<Button size='sm' variant={variant} disabled={act.isPending} onClick={onClick}>
				{label}
			</Button>
		) : null;

	if (!can.readAdvance && !can.readSettlement) return null;
	return (
		<div className='space-y-6'>
			<Card>
				<CardHeader>
					<CardTitle>{t('finance:advances.title')}</CardTitle>
					<CardDescription>{t('finance:advances.description')}</CardDescription>
					{can.createAdvance ? (
						<CardAction>
							<Button size='sm' onClick={() => setCreating(true)}>
								<Plus className='size-4' data-icon='inline-start' />
								{t('finance:advances.create')}
							</Button>
						</CardAction>
					) : null}
				</CardHeader>
				<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t('finance:common.code')}</TableHead>
							<TableHead>{t('finance:advances.employee')}</TableHead>
							<TableHead>{t('finance:advances.purpose')}</TableHead>
							<TableHead className='text-right'>{t('finance:common.amount')}</TableHead>
							<TableHead className='text-right'>{t('finance:advances.settled')}</TableHead>
							<TableHead>{t('finance:common.status')}</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{(advances.data?.rows ?? []).map((row) => {
							const open = row.amount - row.settledAmount;
							const employeeId = row.employeeId ?? '';
							return (
								<TableRow key={row.id}>
									<TableCell className='font-mono text-xs'>{row.code}</TableCell>
									<TableCell>{employeeName.get(employeeId) ?? '—'}</TableCell>
									<TableCell className='max-w-56 truncate'>{row.purpose}</TableCell>
									<TableCell className='text-right tabular-nums'>{money(row.amount)}</TableCell>
									<TableCell className='text-right tabular-nums'>{money(row.settledAmount)}</TableCell>
									<TableCell>
										<Badge variant='outline'>{t(`finance:advances.status.${row.status}`)}</Badge>
									</TableCell>
									<TableCell>
										<div className='flex flex-wrap justify-end gap-1'>
											{button(can.submitAdvance && row.status === 'draft', t('finance:advances.submit'), () =>
												act.mutate({ kind: 'advance', id: row.id, action: 'submit' }),
											)}
											{button(can.approveAdvance && row.status === 'submitted', t('finance:advances.approve'), () =>
												act.mutate({ kind: 'advance', id: row.id, action: 'approve' }),
											)}
											{button(
												can.rejectAdvance && ['draft', 'submitted', 'approved'].includes(row.status),
												t('finance:advances.cancel'),
												() => act.mutate({ kind: 'advance', id: row.id, action: 'cancel' }),
												'ghost',
											)}
											{button(can.pay && row.status === 'approved', t('finance:advances.disburse'), () =>
												setPay({
													employeeId,
													payableType: 'employee_advance',
													payableId: row.id,
													amount: row.amount,
													exact: true,
													direction: 'out',
													title: t('finance:advances.disburse'),
												}),
											)}
											{button(can.createSettlement && row.status === 'disbursed', t('finance:advances.settle'), () => setSettling(row))}
											{button(can.pay && row.status === 'disbursed' && open > 0, t('finance:advances.receiveReturn'), () =>
												setPay({
													employeeId,
													payableType: 'employee_advance',
													payableId: row.id,
													amount: open,
													exact: false,
													direction: 'in',
													title: t('finance:advances.receiveReturn'),
												}),
											)}
										</div>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
					</Table>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('finance:settlements.title')}</CardTitle>
					<CardDescription>{t('finance:settlements.description')}</CardDescription>
				</CardHeader>
				<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t('finance:common.code')}</TableHead>
							<TableHead>{t('finance:advances.employee')}</TableHead>
							<TableHead className='text-right'>{t('finance:common.amount')}</TableHead>
							<TableHead className='text-right'>{t('finance:settlements.offset')}</TableHead>
							<TableHead className='text-right'>{t('finance:settlements.payable')}</TableHead>
							<TableHead>{t('finance:common.status')}</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{(settlements.data?.rows ?? []).map((row: TExpenseSettlement) => (
							<TableRow key={row.id}>
								<TableCell className='font-mono text-xs'>{row.code}</TableCell>
								<TableCell>{employeeName.get(row.employeeId ?? '') ?? '—'}</TableCell>
								<TableCell className='text-right tabular-nums'>{money(row.totalAmount)}</TableCell>
								<TableCell className='text-right tabular-nums'>{money(row.advanceOffsetAmount)}</TableCell>
								<TableCell className='text-right tabular-nums'>{money(row.payableAmount)}</TableCell>
								<TableCell>
									<Badge variant='outline'>{t(`finance:settlements.status.${row.status}`)}</Badge>
								</TableCell>
								<TableCell>
									<div className='flex flex-wrap justify-end gap-1'>
										{button(can.submitSettlement && row.status === 'draft', t('finance:advances.submit'), () =>
											act.mutate({ kind: 'settlement', id: row.id, action: 'submit' }),
										)}
										{button(can.verifySettlement && row.status === 'submitted', t('finance:settlements.verify'), () =>
											act.mutate({ kind: 'settlement', id: row.id, action: 'verify' }),
										)}
										{button(can.approveSettlement && row.status === 'verified', t('finance:advances.approve'), () =>
											act.mutate({ kind: 'settlement', id: row.id, action: 'approve' }),
										)}
										{button(
											can.rejectSettlement && (row.status === 'submitted' || row.status === 'verified'),
											t('finance:settlements.reject'),
											() => act.mutate({ kind: 'settlement', id: row.id, action: 'reject' }),
											'ghost',
										)}
										{button(can.pay && row.status === 'approved' && row.payableAmount > row.paidAmount, t('finance:settlements.payOut'), () =>
											setPay({
												employeeId: row.employeeId ?? '',
												payableType: 'expense_settlement',
												payableId: row.id,
												amount: row.payableAmount - row.paidAmount,
												exact: false,
												direction: 'out',
												title: t('finance:settlements.payOut'),
											}),
										)}
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
				</CardContent>
			</Card>

			<PaymentsTable paymentType='employee_payment' title={t('finance:payments.type.employee_payment')} />

			{creating ? <AdvanceDialog employees={employees.data ?? []} onClose={() => setCreating(false)} onSaved={refresh} /> : null}
			{settling ? <SettlementDialog advance={settling} onClose={() => setSettling(null)} onSaved={refresh} /> : null}
			{pay ? <EmployeePaymentDialog {...pay} onClose={() => setPay(null)} /> : null}
		</div>
	);
}

function AdvanceDialog({
	employees,
	onClose,
	onSaved,
}: {
	employees: Array<{ id: string; fullName: string; employeeCode: string }>;
	onClose: () => void;
	onSaved: () => void;
}) {
	const { t } = useTranslation(['finance', 'common']);
	const [employeeId, setEmployeeId] = useState('none');
	const [amount, setAmount] = useState('');
	const [date, setDate] = useState(today());
	const [purpose, setPurpose] = useState('');
	const save = useMutation({
		mutationFn: () => createAdvance({ employeeId, amount: toMinor(amount), requestDate: date, purpose: purpose.trim() }),
		onSuccess: () => {
			toast.success(t('finance:advances.created'));
			onSaved();
			onClose();
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const valid = employeeId !== 'none' && toMinor(amount) > 0 && purpose.trim() !== '';
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
						<DialogTitle>{t('finance:advances.create')}</DialogTitle>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor='adv-employee'>{t('finance:advances.employee')}</FieldLabel>
						<Select value={employeeId} onValueChange={(value: string | null) => setEmployeeId(value ?? 'none')}>
							<SelectTrigger id='adv-employee'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='none'>{t('finance:common.none')}</SelectItem>
								{employees.map((row) => (
									<SelectItem key={row.id} value={row.id}>
										{row.employeeCode} — {row.fullName}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<div className='grid gap-3 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='adv-date'>{t('finance:common.date')}</FieldLabel>
							<DatePicker value={date} onChange={setDate} />
						</Field>
						<Field>
							<FieldLabel htmlFor='adv-amount'>{t('finance:common.amount')}</FieldLabel>
							<MoneyInput value={amount} onValueChange={setAmount} />
						</Field>
					</div>
					<Field>
						<FieldLabel htmlFor='adv-purpose'>{t('finance:advances.purpose')}</FieldLabel>
						<Input id='adv-purpose' value={purpose} maxLength={500} onChange={(event) => setPurpose(event.target.value)} />
					</Field>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={!valid || save.isPending}>
							{t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}

type TLine = { key: number; expenseDate: string; categoryCode: string; description: string; amount: string; taxAmount: string };

function SettlementDialog({ advance, onClose, onSaved }: { advance: TEmployeeAdvance; onClose: () => void; onSaved: () => void }) {
	const { t } = useTranslation(['finance', 'common']);
	const accounts = useQuery(accountsQueryOptions({ page: 1, limit: 200, accountType: 'expense', isActive: true, isPostable: true }));
	const [date, setDate] = useState(today());
	const [lines, setLines] = useState<TLine[]>([{ key: 1, expenseDate: today(), categoryCode: 'none', description: '', amount: '', taxAmount: '' }]);
	const total = lines.reduce((sum, line) => sum + toMinor(line.amount) + toMinor(line.taxAmount), 0);
	const save = useMutation({
		mutationFn: () =>
			createSettlement({
				employeeAdvanceId: advance.id,
				settlementDate: date,
				items: lines.map((line) => ({
					expenseDate: line.expenseDate,
					categoryCode: line.categoryCode,
					description: line.description.trim() || null,
					amount: toMinor(line.amount),
					taxAmount: toMinor(line.taxAmount),
				})),
			}),
		onSuccess: () => {
			toast.success(t('finance:settlements.created'));
			onSaved();
			onClose();
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const valid = lines.every((line) => line.categoryCode !== 'none' && toMinor(line.amount) >= 0) && total > 0;
	const update = (key: number, patch: Partial<TLine>) => setLines(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
	const open = advance.amount - advance.settledAmount;
	return (
		<Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
			<ScrollDialogContent className='sm:max-w-3xl'>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						if (valid) save.mutate();
					}}
				>
					<DialogHeader>
						<DialogTitle>
							{t('finance:advances.settle')} — {advance.code}
						</DialogTitle>
					</DialogHeader>
					<p className='text-muted-foreground text-sm'>
						{t('finance:settlements.openBalance', { amount: money(open) })}
					</p>
					<Field className='w-48'>
						<FieldLabel htmlFor='set-date'>{t('finance:common.date')}</FieldLabel>
						<DatePicker value={date} onChange={setDate} />
					</Field>
					{lines.map((line) => (
						<div key={line.key} className='grid items-end gap-2 sm:grid-cols-[9rem_1fr_1fr_8rem_7rem_auto]'>
							<DatePicker value={line.expenseDate} onChange={(value) => update(line.key, { expenseDate: value })} />
							<Select value={line.categoryCode} onValueChange={(value: string | null) => update(line.key, { categoryCode: value ?? 'none' })}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='none'>{t('finance:settlements.account')}</SelectItem>
									{(accounts.data?.rows ?? []).map((account) => (
										<SelectItem key={account.id} value={account.code}>
											{account.code} — {account.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Input
								placeholder={t('finance:settlements.lineDescription')}
								value={line.description}
								onChange={(event) => update(line.key, { description: event.target.value })}
							/>
							<MoneyInput placeholder={t('finance:common.amount')} value={line.amount} onValueChange={(value) => update(line.key, { amount: value })} />
							<MoneyInput placeholder={t('finance:settlements.tax')} value={line.taxAmount} onValueChange={(value) => update(line.key, { taxAmount: value })} />
							<Button
								type='button'
								size='icon'
								variant='ghost'
								aria-label={t('finance:settlements.removeLine')}
								disabled={lines.length === 1}
								onClick={() => setLines(lines.filter((item) => item.key !== line.key))}
							>
								<Trash2 className='size-4' />
							</Button>
						</div>
					))}
					<div className='flex items-center justify-between'>
						<Button
							type='button'
							size='sm'
							variant='outline'
							onClick={() =>
								setLines([...lines, { key: Date.now(), expenseDate: today(), categoryCode: 'none', description: '', amount: '', taxAmount: '' }])
							}
						>
							<Plus className='size-4' data-icon='inline-start' />
							{t('finance:settlements.addLine')}
						</Button>
						<span className='text-sm'>
							{t('finance:settlements.total', { amount: money(total) })}
							{total > open ? ` · ${t('finance:settlements.excess', { amount: money(total - open) })}` : ''}
						</span>
					</div>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={!valid || save.isPending}>
							{t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}
