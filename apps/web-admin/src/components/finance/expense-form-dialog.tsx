import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Trash2 } from 'lucide-react';
import { MoneyInput } from '@/components/money-input';
import { toast } from '@/components/toast';
import {
	accountsQueryOptions,
	createExpenseClaim,
	toMinor,
	updateExpenseClaim,
	type TAccount,
	type TExpenseClaimDetail,
} from '@/lib/finance-api';
import { employeePickerQueryOptions, type TEmployeePickerRow } from '@/lib/hr-api';
import { getActiveOrganizationId } from '@/lib/organization-store';

const today = () => new Date().toISOString().slice(0, 10);

type TLineDraft = {
	key: number;
	expenseDate: string;
	categoryCode: string;
	description: string;
	amount: string;
	taxAmount: string;
};

let lineSeq = 0;
const newLine = (): TLineDraft => ({
	key: ++lineSeq,
	expenseDate: today(),
	categoryCode: '',
	description: '',
	amount: '',
	taxAmount: '',
});

const money = (minor: number) => (minor / 100).toLocaleString();

/** Create/edit dialog for an expense claim, with its line editor (ERP-0013). */
export function ExpenseFormDialog(props: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	claim?: TExpenseClaimDetail;
}) {
	return (
		<Dialog open={props.open} onOpenChange={props.onOpenChange}>
			{props.open ? <ExpenseFormBody {...props} /> : null}
		</Dialog>
	);
}

function ExpenseFormBody(props: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	claim?: TExpenseClaimDetail;
}) {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const claim = props.claim;
	const organizationId = getActiveOrganizationId();

	const [employeeId, setEmployeeId] = useState(claim?.employeeId ?? '');
	const [claimDate, setClaimDate] = useState(claim?.claimDate ?? today());
	const [notes, setNotes] = useState(claim?.notes ?? '');
	const [lines, setLines] = useState<TLineDraft[]>(() =>
		claim && claim.items.length > 0
			? claim.items.map((item) => ({
					key: ++lineSeq,
					expenseDate: item.expenseDate ?? today(),
					categoryCode: item.categoryCode ?? '',
					description: item.description ?? '',
					amount: String(item.amount / 100),
					taxAmount: item.taxAmount ? String(item.taxAmount / 100) : '',
				}))
			: [newLine()],
	);

	const employees = useQuery({
		...employeePickerQueryOptions(organizationId ? [organizationId] : []),
		enabled: Boolean(organizationId),
	});
	const accounts = useQuery(
		accountsQueryOptions({ page: 1, limit: 100, accountType: 'expense', isActive: true }),
	);

	const employeeName = useMemo(() => {
		const rows: TEmployeePickerRow[] = employees.data ?? [];
		return new Map(rows.map((row) => [row.id, `${row.employeeCode} - ${row.fullName}`]));
	}, [employees.data]);

	const expenseAccounts: TAccount[] = useMemo(
		() => (accounts.data?.rows ?? []).filter((account) => account.isPostable),
		[accounts.data],
	);

	const total = lines.reduce(
		(sum, line) => sum + toMinor(line.amount) + toMinor(line.taxAmount),
		0,
	);

	const patchLine = (key: number, patch: Partial<TLineDraft>) =>
		setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));

	const save = useMutation({
		mutationFn: () => {
			const items = lines
				.filter((line) => line.categoryCode && toMinor(line.amount) > 0)
				.map((line) => ({
					expenseDate: line.expenseDate || null,
					categoryCode: line.categoryCode,
					description: line.description || null,
					amount: toMinor(line.amount),
					taxAmount: toMinor(line.taxAmount),
				}));
			const payload = {
				employeeId,
				claimDate,
				notes: notes.trim() === '' ? null : notes.trim(),
				items,
			};
			return claim
				? updateExpenseClaim(claim.id, payload)
				: createExpenseClaim(payload);
		},
		onSuccess: async () => {
			toast.success(claim ? t('finance:expenses.updated') : t('finance:expenses.created'));
			await queryClient.invalidateQueries({ queryKey: ['expense-claims'] });
			props.onOpenChange(false);
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const canSave =
		Boolean(employeeId) &&
		Boolean(claimDate) &&
		lines.some((line) => line.categoryCode && toMinor(line.amount) > 0) &&
		!save.isPending;

	return (
		<DialogContent className='sm:max-w-3xl'>
			<DialogHeader>
				<DialogTitle>
					{claim ? t('finance:expenses.edit') : t('finance:expenses.new')}
				</DialogTitle>
				<DialogDescription>{t('finance:expenses.description')}</DialogDescription>
			</DialogHeader>

			<div className='grid gap-3 sm:grid-cols-2'>
				<Select
					value={employeeId || 'none'}
					onValueChange={(value: string | null) =>
						setEmployeeId(value == null || value === 'none' ? '' : value)
					}
				>
					<SelectTrigger>
						<SelectValue placeholder={t('finance:expenses.selectEmployee')} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='none'>{t('finance:expenses.selectEmployee')}</SelectItem>
						{(employees.data ?? []).map((row) => (
							<SelectItem key={row.id} value={row.id}>
								{employeeName.get(row.id) ?? row.fullName}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<DatePicker value={claimDate} onChange={setClaimDate} />
			</div>

			<Input
				placeholder={t('finance:expenses.notes')}
				value={notes}
				onChange={(event) => setNotes(event.target.value)}
			/>

			{expenseAccounts.length === 0 && !accounts.isPending ? (
				<p className='text-destructive text-sm'>{t('finance:expenses.noAccounts')}</p>
			) : null}

			<div className='space-y-2'>
				<div className='flex items-center justify-between'>
					<h3 className='text-sm font-medium'>{t('finance:expenses.lines')}</h3>
					<Button size='sm' variant='outline' onClick={() => setLines((prev) => [...prev, newLine()])}>
						{t('finance:expenses.addLine')}
					</Button>
				</div>

				{lines.map((line) => (
					<div key={line.key} className='flex flex-wrap items-center gap-2 rounded-md border p-2'>
						<DatePicker
							className='w-36'
							value={line.expenseDate}
							onChange={(value) => patchLine(line.key, { expenseDate: value })}
						/>
						<Select
							value={line.categoryCode || 'none'}
							onValueChange={(value: string | null) =>
								patchLine(line.key, {
									categoryCode: value == null || value === 'none' ? '' : value,
								})
							}
						>
							<SelectTrigger className='w-56'>
								<SelectValue placeholder={t('finance:expenses.selectCategory')} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='none'>{t('finance:expenses.selectCategory')}</SelectItem>
								{expenseAccounts.map((account) => (
									<SelectItem key={account.id} value={account.code}>
										{account.code} - {account.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Input
							className='w-48'
							placeholder={t('finance:expenses.lineDescription')}
							value={line.description}
							onChange={(event) => patchLine(line.key, { description: event.target.value })}
						/>
						<MoneyInput
							className='w-32'
							placeholder={t('finance:expenses.amount')}
							value={line.amount}
							onValueChange={(value) => patchLine(line.key, { amount: value })}
						/>
						<MoneyInput
							className='w-28'
							placeholder={t('finance:expenses.tax')}
							value={line.taxAmount}
							onValueChange={(value) => patchLine(line.key, { taxAmount: value })}
						/>
						<Button
							size='icon'
							variant='ghost'
							aria-label={t('finance:expenses.removeLine')}
							disabled={lines.length === 1}
							onClick={() => setLines((prev) => prev.filter((row) => row.key !== line.key))}
						>
							<Trash2 className='size-4' />
						</Button>
					</div>
				))}
			</div>

			<div className='flex items-center justify-between text-sm'>
				<span className='text-muted-foreground'>{t('finance:expenses.totalHint')}</span>
				<span className='font-medium'>
					{t('finance:expenses.total')}: {money(total)}
				</span>
			</div>

			<DialogFooter>
				<Button variant='outline' onClick={() => props.onOpenChange(false)}>
					{t('common:action.cancel')}
				</Button>
				<Button disabled={!canSave} onClick={() => void save.mutateAsync()}>
					{save.isPending ? t('finance:expenses.saving') : t('finance:expenses.save')}
				</Button>
			</DialogFooter>
		</DialogContent>
	);
}
