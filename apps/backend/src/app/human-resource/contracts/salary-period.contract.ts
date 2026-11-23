import type { TEmployeeSalaryInsert, TEmployeeSalarySelect } from '@drizzle/schemas/human-resource.schema';
import type { TTx } from '@drizzle/types';
import { z } from 'zod';

/**
 * Effective-dated salary periods of an employee (`human_resource.employee_salaries`,
 * ERP-0119, grill-me Q8/Q16). Money is integer IDR minor units; dates are
 * Jakarta `YYYY-MM-DD` business dates.
 */

const money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

/** A new period: it closes the current one the day before it starts. */
export const salaryPeriodCreateSchema = z.object({
	effectiveFrom: z.iso.date(),
	baseSalary: money,
	fixedAllowances: money.default(0),
});

/** Only the amounts of the active period are edited; a new date is a new period. */
export const salaryPeriodUpdateSchema = z.object({
	baseSalary: money,
	fixedAllowances: money.default(0),
});

export type TSalaryPeriodCreate = z.output<typeof salaryPeriodCreateSchema>;
export type TSalaryPeriodUpdate = z.output<typeof salaryPeriodUpdateSchema>;

type TWrite = Omit<TEmployeeSalaryInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/** Persistence port of `human_resource.employee_salaries`. */
export interface ISalaryPeriodRepository {
	/** Live periods of an employee, newest first. */
	listForEmployee(employeeId: string): Promise<TEmployeeSalarySelect[]>;
	findById(id: string): Promise<TEmployeeSalarySelect | null>;
	/** The live period with the latest start, if any. */
	findLatest(employeeId: string, tx?: TTx): Promise<TEmployeeSalarySelect | null>;
	/** Live periods of any employee that overlap `start`..`end` (payroll drafts). */
	listOverlapping(start: string, end: string): Promise<TEmployeeSalarySelect[]>;
	insert(row: TWrite, tx?: TTx): Promise<TEmployeeSalarySelect>;
	update(id: string, data: Partial<TWrite>, tx?: TTx): Promise<TEmployeeSalarySelect | null>;
	softDelete(id: string, tx?: TTx): Promise<boolean>;
}
