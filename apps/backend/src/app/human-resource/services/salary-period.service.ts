import type { TEmployeeSalarySelect } from '@drizzle/schemas/human-resource.schema';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import { HR_PEOPLE_SERVICE_TOKEN, SALARY_PERIOD_REPOSITORY_TOKEN } from '../constants/di';
import type { THrScope } from '../contracts/hr-records.contract';
import type { ISalaryPeriodRepository, TSalaryPeriodCreate, TSalaryPeriodUpdate } from '../contracts/salary-period.contract';
import { HrNotFoundError, SalaryPeriodError } from '../errors/hr.errors';
import { addDays } from '../utils/hr';
import type { HrPeopleService } from './people.service';

export type TSalaryPeriodView = Pick<
	TEmployeeSalarySelect,
	'id' | 'employeeId' | 'baseSalary' | 'fixedAllowances' | 'currencyCode' | 'effectiveFrom' | 'effectiveTo' | 'isActive'
>;

const view = (row: TEmployeeSalarySelect): TSalaryPeriodView => ({
	id: row.id,
	employeeId: row.employeeId,
	baseSalary: row.baseSalary,
	fixedAllowances: row.fixedAllowances,
	currencyCode: row.currencyCode,
	effectiveFrom: row.effectiveFrom,
	effectiveTo: row.effectiveTo,
	isActive: row.isActive,
});

/**
 * Effective-dated salary periods of an employee (ERP-0119, grill-me Q8/Q16).
 *
 * @remarks
 * A new period must start after the latest one and closes it the day
 * before (`effective_to`, `is_active = false`). Only the active period's
 * amounts are edited; only the latest period is deleted, which reopens the
 * one before it. Writes that touch two rows run in one transaction.
 */
@injectable()
export class SalaryPeriodService {
	constructor(
		@inject(SALARY_PERIOD_REPOSITORY_TOKEN) private readonly repository: ISalaryPeriodRepository,
		@inject(HR_PEOPLE_SERVICE_TOKEN) private readonly employees: Pick<HrPeopleService, 'require'>,
		@inject(TRANSACTION_RUNNER_TOKEN) private readonly transactions: ITransactionRunner,
	) {}

	async list(scope: THrScope, employeeId: string): Promise<TSalaryPeriodView[]> {
		await this.employees.require(scope, employeeId);
		return (await this.repository.listForEmployee(employeeId)).map(view);
	}

	/** The period, if its employee is visible to the caller. */
	private async requirePeriod(scope: THrScope, id: string): Promise<TEmployeeSalarySelect> {
		const row = await this.repository.findById(id);
		const employee = row ? await this.employees.require(scope, row.employeeId).catch(() => null) : null;
		if (!row || !employee) throw new HrNotFoundError('salaryPeriod');
		return row;
	}

	async create(scope: THrScope, actorUserId: string, employeeId: string, body: TSalaryPeriodCreate): Promise<TSalaryPeriodView> {
		await this.employees.require(scope, employeeId);
		const created = await this.transactions.run(async (tx) => {
			const latest = await this.repository.findLatest(employeeId, tx);
			if (latest && body.effectiveFrom <= latest.effectiveFrom) {
				throw new SalaryPeriodError('overlap', { after: latest.effectiveFrom });
			}
			if (latest) {
				await this.repository.update(latest.id, { effectiveTo: addDays(body.effectiveFrom, -1), isActive: false }, tx);
			}
			return this.repository.insert(
				{
					employeeId,
					baseSalary: body.baseSalary,
					fixedAllowances: body.fixedAllowances,
					effectiveFrom: body.effectiveFrom,
					effectiveTo: null,
					isActive: true,
					createdBy: actorUserId,
				},
				tx,
			);
		});
		return view(created);
	}

	async update(scope: THrScope, id: string, body: TSalaryPeriodUpdate): Promise<TSalaryPeriodView> {
		const current = await this.requirePeriod(scope, id);
		if (!current.isActive) throw new SalaryPeriodError('notActive');
		const updated = await this.repository.update(id, { baseSalary: body.baseSalary, fixedAllowances: body.fixedAllowances });
		if (!updated) throw new HrNotFoundError('salaryPeriod');
		return view(updated);
	}

	async remove(scope: THrScope, id: string): Promise<{ removed: true }> {
		const current = await this.requirePeriod(scope, id);
		await this.transactions.run(async (tx) => {
			const latest = await this.repository.findLatest(current.employeeId, tx);
			if (latest?.id !== id) throw new SalaryPeriodError('notLatest');
			await this.repository.softDelete(id, tx);
			const previous = await this.repository.findLatest(current.employeeId, tx);
			if (previous) await this.repository.update(previous.id, { effectiveTo: null, isActive: true }, tx);
		});
		return { removed: true };
	}

	/**
	 * Base salary and fixed allowances per employee for a payroll month: the
	 * period in force on the month's last day, else the latest one that
	 * overlaps the month.
	 */
	async amountsFor(start: string, end: string): Promise<Map<string, { baseSalary: number; allowances: number }>> {
		const rows = await this.repository.listOverlapping(start, end);
		const amounts = new Map<string, { baseSalary: number; allowances: number }>();
		// Newest start first: the first row per employee is the one in force at the end.
		for (const row of rows) {
			if (!amounts.has(row.employeeId)) amounts.set(row.employeeId, { baseSalary: row.baseSalary, allowances: row.fixedAllowances });
		}
		return amounts;
	}
}
