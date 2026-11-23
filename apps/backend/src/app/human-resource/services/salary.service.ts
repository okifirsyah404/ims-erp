import type { TEmployeeSelect, TEmployeeSalaryRecordSelect } from '@drizzle/schemas/human-resource.schema';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import { HR_PEOPLE_SERVICE_TOKEN, LEAVE_SERVICE_TOKEN, PAYSLIP_QUEUE_TOKEN, SALARY_PERIOD_SERVICE_TOKEN, SALARY_REPOSITORY_TOKEN } from '../constants/di';
import type { IPayslipQueue } from '../contracts/payslip.contract';
import type { THrScope, TSalaryBody } from '../contracts/hr-records.contract';
import type { ISalaryRepository } from '../contracts/hr-records.repository.interface';
import { HrNotFoundError, ImportFileError, SalaryStateError } from '../errors/hr.errors';
import { netPay, periodRange, previousPeriod } from '../utils/hr';
import { assertImportFile, type TImportResult, type TRowError } from '../utils/import-file';
import { MAX_IMPORT_ROWS, readRows, templateWorkbook } from '../utils/spreadsheet';
import { type HrPeopleService, worksOn } from './people.service';
import type { LeaveService } from './leave.service';
import type { SalaryPeriodService } from './salary-period.service';

export type TSalaryPeriod = {
	period: string;
	rows: (TEmployeeSalaryRecordSelect & { overtimeHours: number })[];
	totals: Pick<TEmployeeSalaryRecordSelect, 'baseSalary' | 'allowances' | 'overtimePay' | 'bonus' | 'deductions' | 'netPay'>;
	/** `empty`, `draft` (something to approve) or `approved` (all locked). */
	state: 'empty' | 'draft' | 'approved';
};

const AMOUNTS = ['baseSalary', 'allowances', 'overtimePay', 'bonus', 'deductions', 'netPay'] as const;

/** Whole or decimal rupiah as typed in a sheet (`1.500.000`, `1500000,50`) → minor units. */
/** Employees by upper-cased code; a code used in two organizations maps to `null` (ambiguous). */
function byCode(employees: TEmployeeSelect[]): Map<string, TEmployeeSelect | null> {
	const map = new Map<string, TEmployeeSelect | null>();
	for (const employee of employees) {
		const key = employee.employeeCode.toUpperCase();
		map.set(key, map.has(key) ? null : employee);
	}
	return map;
}

function rupiahCell(value: string): number | null {
	if (value === '') return 0;
	const normalized = value.replace(/[Rp\s]/gi, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
	if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
	return Math.round(Number(normalized) * 100);
}

/**
 * Monthly salary summaries (M08 stage 1, decision of 2026-11-07).
 *
 * @remarks
 * HR / finance enter or import base salary, allowances, overtime pay,
 * bonus and deductions per employee per month; net pay is computed. The
 * owner approves the whole period, which locks it. Approved overtime hours
 * are shown next to each row as a reference; there is no payroll engine
 * (stage 2) and no journal (M09) yet.
 */
@injectable()
export class SalaryService {
	constructor(
		@inject(SALARY_REPOSITORY_TOKEN) private readonly repository: ISalaryRepository,
		@inject(HR_PEOPLE_SERVICE_TOKEN) private readonly employees: Pick<HrPeopleService, 'require' | 'listVisible' | 'findByCodes'>,
		@inject(LEAVE_SERVICE_TOKEN) private readonly leave: Pick<LeaveService, 'approvedHours'>,
		@inject(TRANSACTION_RUNNER_TOKEN) private readonly transactions: ITransactionRunner,
		@inject(SALARY_PERIOD_SERVICE_TOKEN) private readonly periods: Pick<SalaryPeriodService, 'amountsFor'>,
		/** ERP-0122: the payslip PDF queue; optional so tests that do not approve can omit it. */
		@inject(PAYSLIP_QUEUE_TOKEN) private readonly payslips?: IPayslipQueue,
	) {}

	async period(scope: THrScope, period: string): Promise<TSalaryPeriod> {
		const [rows, hours] = await Promise.all([this.repository.listPeriod(period, scope), this.leave.approvedHours(period)]);
		const byEmployee = new Map(hours.map((row) => [row.employeeId, row.hours]));
		const totals = Object.fromEntries(AMOUNTS.map((key) => [key, rows.reduce((sum, row) => sum + row[key], 0)])) as TSalaryPeriod['totals'];
		return {
			period,
			rows: rows.map((row) => ({ ...row, overtimeHours: byEmployee.get(row.employeeId) ?? 0 })),
			totals,
			state: rows.length === 0 ? 'empty' : rows.some((row) => row.status === 'draft') ? 'draft' : 'approved',
		};
	}

	async save(scope: THrScope, actorUserId: string, body: TSalaryBody): Promise<TEmployeeSalaryRecordSelect> {
		const employee = await this.employees.require(scope, body.employeeId);
		if (netPay(body) < 0) throw new SalaryStateError('netNegative');
		const saved = await this.repository.upsertDraft({
			...body,
			employeeName: employee.fullName,
			netPay: netPay(body),
			status: 'draft',
			createdBy: actorUserId,
		});
		if (!saved) throw new SalaryStateError('locked');
		return saved;
	}

	async remove(scope: THrScope, id: string): Promise<void> {
		const row = await this.repository.findById(id);
		if (!row || !(await this.employees.require(scope, row.employeeId).catch(() => null))) throw new HrNotFoundError('salary');
		if (!(await this.repository.removeDraft(id))) throw new SalaryStateError('locked');
	}

	/** Drafts every active employee without a row yet, at their base salary. */
	/**
	 * Drafts a row for every visible employee who worked in the period and
	 * has none yet. Base salary and allowances are copied from the previous
	 * month's summary (ERP-0034 employees carry no salary; the salary
	 * components of `docs.dbml` are not built yet), otherwise 0.
	 */
	/** `actorUserId` is `null` for the daily payday run (ERP-0120). */
	async generate(scope: THrScope, actorUserId: string | null, period: string): Promise<TSalaryPeriod> {
		const { start, end } = periodRange(period);
		const [current, previous, people, agreed] = await Promise.all([
			this.repository.listPeriod(period, scope),
			this.repository.listPeriod(previousPeriod(period), scope),
			this.employees.listVisible(scope),
			this.periods.amountsFor(start, end),
		]);
		const existing = new Set(current.map((row) => row.employeeId));
		const last = new Map(previous.map((row) => [row.employeeId, row]));
		const working = (employee: TEmployeeSelect) => worksOn(employee, start) || worksOn(employee, end);
		for (const employee of people.filter(working)) {
			if (existing.has(employee.id)) continue;
			// The salary period in force (ERP-0119); without one, last month's summary.
			const before = agreed.get(employee.id) ?? last.get(employee.id);
			const amounts = { baseSalary: before?.baseSalary ?? 0, allowances: before?.allowances ?? 0, overtimePay: 0, bonus: 0, deductions: 0 };
			await this.repository.upsertDraft({
				...amounts,
				period,
				employeeId: employee.id,
				employeeName: employee.fullName,
				netPay: netPay(amounts),
				notes: null,
				status: 'draft',
				createdBy: actorUserId,
			});
		}
		return this.period(scope, period);
	}

	/** The owner locks the period (`payroll:approve`, checked by the controller). */
	async approve(scope: THrScope, actorUserId: string, period: string): Promise<TSalaryPeriod> {
		const approved = await this.repository.approvePeriod(period, actorUserId, scope);
		if (approved.length === 0) throw new SalaryStateError('nothingToApprove');
		// ERP-0122 (grill-me Q32): one payslip PDF per approved record; the queue never fails the approval.
		for (const recordId of approved) await this.payslips?.enqueue(recordId);
		return this.period(scope, period);
	}

	template(): Promise<Uint8Array> {
		return templateWorkbook(
			'Gaji',
			['kode_karyawan', 'gaji_pokok', 'tunjangan', 'lembur', 'bonus', 'potongan', 'catatan'],
			[['EMP-0001', '5000000', '500000', '250000', '0', '100000', '']],
		);
	}

	/** Imports a period sheet; all rows or none (amounts in rupiah). */
	async import(scope: THrScope, actorUserId: string, period: string, file: unknown): Promise<TImportResult> {
		const rows = await readRows(assertImportFile(file));
		if (rows.length === 0) throw new ImportFileError('empty');
		if (rows.length > MAX_IMPORT_ROWS) throw new ImportFileError('tooMany');
		const locked = new Set((await this.repository.listPeriod(period, scope)).filter((row) => row.status === 'approved').map((row) => row.employeeId));
		const people = byCode(await this.employees.findByCodes(scope, [...new Set(rows.map(({ cells }) => (cells[0] ?? '').toUpperCase()))]));
		const errors: TRowError[] = [];
		const seen = new Set<string>();
		const drafts: Parameters<ISalaryRepository['upsertDraft']>[0][] = [];
		for (const { row, cells } of rows) {
			const [code = '', ...rest] = cells;
			const found = people.get(code.toUpperCase());
			const employee = found ?? undefined;
			const amounts = rest.slice(0, 5).concat(['', '', '', '', '']).slice(0, 5).map(rupiahCell);
			if (found === null) errors.push({ row, code: 'employeeAmbiguous', value: code });
			else if (!employee) errors.push({ row, code: 'employeeUnknown', value: code });
			amounts.forEach((amount, index) => {
				if (amount === null) errors.push({ row, code: 'amountInvalid', value: rest[index] ?? '' });
			});
			if (!employee || amounts.some((amount) => amount === null)) continue;
			if (seen.has(employee.id)) errors.push({ row, code: 'duplicate', value: code });
			if (locked.has(employee.id)) errors.push({ row, code: 'salaryLocked', value: code });
			seen.add(employee.id);
			const [baseSalary, allowances, overtimePay, bonus, deductions] = amounts as number[];
			const values = { baseSalary: baseSalary!, allowances: allowances!, overtimePay: overtimePay!, bonus: bonus!, deductions: deductions! };
			if (netPay(values) < 0) errors.push({ row, code: 'netNegative', value: code });
			drafts.push({
				...values,
				period,
				employeeId: employee.id,
				employeeName: employee.fullName,
				netPay: netPay(values),
				notes: rest[5] || null,
				status: 'draft',
				createdBy: actorUserId,
			});
		}
		if (errors.length > 0) return { imported: 0, errors };
		await this.transactions.run(async (tx) => {
			for (const draft of drafts) await this.repository.upsertDraft(draft, tx);
		});
		return { imported: drafts.length, errors: [] };
	}
}
