import type { TSalarySummarySelect } from '@drizzle/schemas/hr.schema';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import { EMPLOYEE_SERVICE_TOKEN, LEAVE_SERVICE_TOKEN, SALARY_REPOSITORY_TOKEN } from '../constants/di';
import type { TSalaryBody } from '../contracts/hr.contract';
import type { ISalaryRepository } from '../contracts/hr.repository.interface';
import { HrNotFoundError, ImportFileError, SalaryStateError } from '../errors/hr.errors';
import { netPay } from '../utils/hr';
import { assertImportFile, type TImportResult, type TRowError } from '../utils/import-file';
import { MAX_IMPORT_ROWS, readRows, templateWorkbook } from '../utils/spreadsheet';
import type { EmployeeService } from './employee.service';
import type { LeaveService } from './leave.service';

export type TSalaryPeriod = {
	period: string;
	rows: (TSalarySummarySelect & { overtimeHours: number })[];
	totals: Pick<TSalarySummarySelect, 'baseSalary' | 'allowances' | 'overtimePay' | 'bonus' | 'deductions' | 'netPay'>;
	/** `empty`, `draft` (something to approve) or `approved` (all locked). */
	state: 'empty' | 'draft' | 'approved';
};

const AMOUNTS = ['baseSalary', 'allowances', 'overtimePay', 'bonus', 'deductions', 'netPay'] as const;

/** Whole or decimal rupiah as typed in a sheet (`1.500.000`, `1500000,50`) → minor units. */
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
		@inject(EMPLOYEE_SERVICE_TOKEN) private readonly employees: Pick<EmployeeService, 'require' | 'listActiveRows' | 'findByCodes'>,
		@inject(LEAVE_SERVICE_TOKEN) private readonly leave: Pick<LeaveService, 'approvedHours'>,
		@inject(TRANSACTION_RUNNER_TOKEN) private readonly transactions: ITransactionRunner,
	) {}

	async period(period: string): Promise<TSalaryPeriod> {
		const [rows, hours] = await Promise.all([this.repository.listPeriod(period), this.leave.approvedHours(period)]);
		const byEmployee = new Map(hours.map((row) => [row.employeeId, row.hours]));
		const totals = Object.fromEntries(AMOUNTS.map((key) => [key, rows.reduce((sum, row) => sum + row[key], 0)])) as TSalaryPeriod['totals'];
		return {
			period,
			rows: rows.map((row) => ({ ...row, overtimeHours: byEmployee.get(row.employeeId) ?? 0 })),
			totals,
			state: rows.length === 0 ? 'empty' : rows.some((row) => row.status === 'draft') ? 'draft' : 'approved',
		};
	}

	async save(actorUserId: string, body: TSalaryBody): Promise<TSalarySummarySelect> {
		const employee = await this.employees.require(body.employeeId);
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

	async remove(id: string): Promise<void> {
		const row = await this.repository.findById(id);
		if (!row) throw new HrNotFoundError('salary');
		if (!(await this.repository.removeDraft(id))) throw new SalaryStateError('locked');
	}

	/** Drafts every active employee without a row yet, at their base salary. */
	async generate(actorUserId: string, period: string): Promise<TSalaryPeriod> {
		const existing = new Set((await this.repository.listPeriod(period)).map((row) => row.employeeId));
		for (const employee of await this.employees.listActiveRows()) {
			if (existing.has(employee.id)) continue;
			const amounts = { baseSalary: employee.baseSalary, allowances: 0, overtimePay: 0, bonus: 0, deductions: 0 };
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
		return this.period(period);
	}

	/** The owner locks the period (`payroll:approve`, checked by the controller). */
	async approve(actorUserId: string, period: string): Promise<TSalaryPeriod> {
		if ((await this.repository.approvePeriod(period, actorUserId)) === 0) throw new SalaryStateError('nothingToApprove');
		return this.period(period);
	}

	template(): Promise<Uint8Array> {
		return templateWorkbook(
			'Gaji',
			['kode_karyawan', 'gaji_pokok', 'tunjangan', 'lembur', 'bonus', 'potongan', 'catatan'],
			[['EMP-0001', '5000000', '500000', '250000', '0', '100000', '']],
		);
	}

	/** Imports a period sheet; all rows or none (amounts in rupiah). */
	async import(actorUserId: string, period: string, file: unknown): Promise<TImportResult> {
		const rows = await readRows(assertImportFile(file));
		if (rows.length === 0) throw new ImportFileError('empty');
		if (rows.length > MAX_IMPORT_ROWS) throw new ImportFileError('tooMany');
		const locked = new Set((await this.repository.listPeriod(period)).filter((row) => row.status === 'approved').map((row) => row.employeeId));
		const people = new Map(
			(await this.employees.findByCodes([...new Set(rows.map(({ cells }) => (cells[0] ?? '').toUpperCase()))])).map((employee) => [
				employee.employeeCode.toUpperCase(),
				employee,
			]),
		);
		const errors: TRowError[] = [];
		const seen = new Set<string>();
		const drafts: Parameters<ISalaryRepository['upsertDraft']>[0][] = [];
		for (const { row, cells } of rows) {
			const [code = '', ...rest] = cells;
			const employee = people.get(code.toUpperCase());
			const amounts = rest.slice(0, 5).concat(['', '', '', '', '']).slice(0, 5).map(rupiahCell);
			if (!employee) errors.push({ row, code: 'employeeUnknown', value: code });
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
