import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { MonthPicker } from '@ims-erp/ui/components/month-picker';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { EmployeeSelect } from '@/components/hr/employee-select';
import { ImportDialog } from '@/components/hr/import-dialog';
import { toast } from '@/components/toast';
import { formatIdr, minorToRupiah, rupiahToMinor, todayBusinessDate } from '@/lib/format';
import {
	approveSalary,
	generateSalary,
	importSalary,
	removeSalary,
	salaryQueryOptions,
	saveSalary,
	type TSalaryRow,
} from '@/lib/hr-records-api';
import { usePermission } from '@/lib/use-permission';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { SectionSkeleton } from '@/components/page-skeleton';

/** `/hr/payroll` — monthly salary summaries, approved by the owner (M08). */
export const Route = createFileRoute('/_authed/hr/payroll/')({
	component: SalaryPage,
});

const AMOUNT_FIELDS = ['baseSalary', 'allowances', 'overtimePay', 'bonus', 'deductions'] as const;
type TAmountField = (typeof AMOUNT_FIELDS)[number];
const AMOUNT_LABEL: Record<TAmountField | 'netPay', 'salary.base' | 'salary.allowances' | 'salary.overtime' | 'salary.bonus' | 'salary.deductions' | 'salary.net'> = {
	baseSalary: 'salary.base',
	allowances: 'salary.allowances',
	overtimePay: 'salary.overtime',
	bonus: 'salary.bonus',
	deductions: 'salary.deductions',
	netPay: 'salary.net',
};

type TEditing = { row: TSalaryRow | null };

function SalaryPage() {
	const { t } = useTranslation(['hr', 'common']);
	const queryClient = useQueryClient();
	const canEdit = usePermission('payroll.update');
	const canCreate = usePermission('payroll.create');
	const canApprove = usePermission('payroll.approve');
	const [period, setPeriod] = useState(todayBusinessDate().slice(0, 7));
	const { data, isPending, isError, error } = useQuery(salaryQueryOptions(period));
	const [editing, setEditing] = useState<TEditing | null>(null);
	const [importing, setImporting] = useState(false);
	const [approving, setApproving] = useState(false);
	const [busy, setBusy] = useState(false);

	const run = async (work: () => Promise<unknown>, done: string) => {
		setBusy(true);
		try {
			await work();
			await queryClient.invalidateQueries({ queryKey: ['hr', 'salary'] });
			toast.success(done);
			return true;
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
			return false;
		} finally {
			setBusy(false);
		}
	};
	const locked = data?.state === 'approved';

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('hr:salary.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('hr:salary.description')}</p>
				</div>
				<div className='flex flex-wrap gap-2'>
					{canCreate && !locked && (
						<>
							<Button variant='outline' disabled={busy} onClick={() => void run(() => generateSalary(period), t('hr:salary.generated'))}>
								{t('hr:salary.generate')}
							</Button>
							<Button variant='outline' onClick={() => setImporting(true)}>
								{t('hr:salary.import')}
							</Button>
						</>
					)}
					{canEdit && !locked && <Button onClick={() => setEditing({ row: null })}>{t('hr:salary.add')}</Button>}
					{canApprove && data?.state === 'draft' && (
						<Button variant='secondary' onClick={() => setApproving(true)}>
							{t('hr:salary.approve')}
						</Button>
					)}
				</div>
			</div>
			<div className='flex flex-wrap items-center gap-3'>
				<MonthPicker
					className='w-44'
					aria-label={t('hr:salary.period')}
					value={period}
					onChange={setPeriod}
				/>
				{data && <Badge variant={locked ? 'default' : 'outline'}>{t(`hr:salary.state.${data.state}`)}</Badge>}
			</div>
			{isPending ? (
				<SectionSkeleton lines={6} />
			) : isError ? (
				<ErrorState error={error} bordered />
			) : data.rows.length === 0 ? (
				<EmptyState title={t('hr:salary.empty')} bordered />
			) : (
				<div className='overflow-hidden rounded-md border'>
					<div>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('hr:field.employee')}</TableHead>
									{[...AMOUNT_FIELDS, 'netPay' as const].map((field) => (
										<TableHead key={field} className='text-right'>
											{t(`hr:${AMOUNT_LABEL[field]}`)}
										</TableHead>
									))}
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.rows.map((row) => (
									<TableRow key={row.id}>
										<TableCell>
											<div className='font-medium'>{row.employeeName}</div>
											{row.overtimeHours > 0 && (
												<div className='text-xs text-muted-foreground'>{t('hr:salary.overtimeHours', { hours: row.overtimeHours })}</div>
											)}
											{row.notes && <div className='max-w-56 truncate text-xs text-muted-foreground'>{row.notes}</div>}
										</TableCell>
										{[...AMOUNT_FIELDS, 'netPay' as const].map((field) => (
											<TableCell key={field} className={`text-right whitespace-nowrap tabular-nums ${field === 'netPay' ? 'font-medium' : ''}`}>
												{formatIdr(row[field])}
											</TableCell>
										))}
										<TableCell className='text-right whitespace-nowrap'>
											{canEdit && row.status === 'draft' && (
												<>
													<Button size='sm' variant='ghost' onClick={() => setEditing({ row })}>
														{t('hr:salary.edit')}
													</Button>
													<Button size='sm' variant='ghost' disabled={busy} onClick={() => void run(() => removeSalary(row.id), t('hr:salary.removed'))}>
														{t('hr:salary.remove')}
													</Button>
												</>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
							<TableFooter>
								<TableRow>
									<TableCell className='font-medium'>{t('hr:salary.total')}</TableCell>
									{[...AMOUNT_FIELDS, 'netPay' as const].map((field) => (
										<TableCell key={field} className='text-right font-medium whitespace-nowrap tabular-nums'>
											{formatIdr(data.totals[field])}
										</TableCell>
									))}
									<TableCell />
								</TableRow>
							</TableFooter>
						</Table>
					</div>
				</div>
			)}

			{editing && (
				<SalaryRowDialog
					period={period}
					row={editing.row}
					onClose={() => setEditing(null)}
					onSave={async (input) => {
						if (await run(() => saveSalary(input), t('hr:salary.saved'))) setEditing(null);
					}}
					busy={busy}
				/>
			)}
			<ImportDialog
				open={importing}
				onOpenChange={setImporting}
				templatePath='/human-resources/salary-records/template'
				templateName='template-gaji.xlsx'
				templateLabel={t('hr:salary.template')}
				onImport={(file) => importSalary(period, file)}
				onDone={() => void queryClient.invalidateQueries({ queryKey: ['hr', 'salary'] })}
			/>
			<Dialog open={approving} onOpenChange={setApproving}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('hr:salary.approve')}</DialogTitle>
						<DialogDescription>{t('hr:salary.approveHint')}</DialogDescription>
					</DialogHeader>
					{data && <p className='py-2 text-sm'>{t('hr:salary.total')}: {formatIdr(data.totals.netPay)}</p>}
					<DialogFooter>
						<Button variant='outline' onClick={() => setApproving(false)}>
							{t('common:action.cancel')}
						</Button>
						<Button
							disabled={busy}
							onClick={async () => {
								if (await run(() => approveSalary(period), t('hr:salary.approved'))) setApproving(false);
							}}
						>
							{t('hr:salary.approve')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function SalaryRowDialog({
	period,
	row,
	onClose,
	onSave,
	busy,
}: {
	period: string;
	row: TSalaryRow | null;
	onClose: () => void;
	onSave: (input: Parameters<typeof saveSalary>[0]) => Promise<void>;
	busy: boolean;
}) {
	const { t } = useTranslation(['hr', 'common']);
	const [employeeId, setEmployeeId] = useState(row?.employeeId ?? '');
	const [amounts, setAmounts] = useState<Record<TAmountField, string>>(
		() => Object.fromEntries(AMOUNT_FIELDS.map((field) => [field, row ? minorToRupiah(row[field]) : ''])) as Record<TAmountField, string>,
	);
	const [notes, setNotes] = useState(row?.notes ?? '');
	const minor = Object.fromEntries(AMOUNT_FIELDS.map((field) => [field, rupiahToMinor(amounts[field])])) as Record<TAmountField, number>;
	const net = minor.baseSalary + minor.allowances + minor.overtimePay + minor.bonus - minor.deductions;

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void onSave({ period, employeeId, ...minor, notes: notes.trim() || null });
					}}
				>
					<DialogHeader>
						<DialogTitle>{row ? t('hr:salary.edit') : t('hr:salary.add')}</DialogTitle>
						<DialogDescription>{t('hr:salary.amountHint')}</DialogDescription>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<Field>
							<FieldLabel htmlFor='salary-employee'>{t('hr:field.employee')}</FieldLabel>
							{row ? <p className='text-sm'>{row.employeeName}</p> : <EmployeeSelect id='salary-employee' required value={employeeId} onChange={setEmployeeId} />}
						</Field>
						<div className='grid gap-3 sm:grid-cols-2'>
							{AMOUNT_FIELDS.map((field) => (
								<Field key={field}>
									<FieldLabel htmlFor={`salary-${field}`}>{t(`hr:${AMOUNT_LABEL[field]}`)}</FieldLabel>
									<Input
										id={`salary-${field}`}
										type='number'
										min='0'
										step='0.01'
										inputMode='decimal'
										required={field === 'baseSalary'}
										value={amounts[field]}
										onChange={(event) => setAmounts({ ...amounts, [field]: event.target.value })}
									/>
								</Field>
							))}
							<Field>
								<FieldLabel>{t('hr:salary.net')}</FieldLabel>
								<p className={`py-2 text-sm font-medium ${net < 0 ? 'text-destructive' : ''}`}>{formatIdr(net)}</p>
							</Field>
						</div>
						<Field>
							<FieldLabel htmlFor='salary-notes'>{t('hr:field.notes')}</FieldLabel>
							<Input id='salary-notes' maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} />
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={busy || !employeeId || net < 0}>
							{t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
