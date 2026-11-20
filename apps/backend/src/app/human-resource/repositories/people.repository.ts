import { DRIZZLE_TOKEN } from '@di/provider';
import { employeeSalaries, employees } from '@drizzle/schemas/human-resource.schema';
import { and, asc, eq, inArray, isNull, or, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { TEmployeeSalaryBody, THrScope } from '../contracts/hr-records.contract';
import type { IHrPeopleRepository } from '../contracts/hr-records.repository.interface';

/** Employees the scope sees: company-level and the active organization's, or all. */
function visibleEmployee(scope: THrScope): SQL | undefined {
	if (scope.all) return undefined;
	return or(isNull(employees.organizationId), eq(employees.organizationId, scope.organizationId));
}

/**
 * Filter for a record table's `employee_id`: only records of employees the
 * scope sees (`undefined` for an application admin).
 */
export function visibleEmployees(employeeId: AnyColumn, scope: THrScope): SQL | undefined {
	if (scope.all) return undefined;
	return sql`${employeeId} IN (SELECT ${employees.id} FROM ${employees} WHERE ${employees.organizationId} IS NULL OR ${employees.organizationId} = ${scope.organizationId})`;
}

/** Drizzle implementation of {@link IHrPeopleRepository}. */
@injectable()
export class HrPeopleRepository implements IHrPeopleRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async findVisible(id: string, scope: THrScope) {
		const [row] = await this.database
			.select()
			.from(employees)
			.where(and(eq(employees.id, id), isNull(employees.deletedAt), visibleEmployee(scope)))
			.limit(1);
		return row ?? null;
	}

	listVisible(scope: THrScope) {
		return this.database
			.select()
			.from(employees)
			.where(and(isNull(employees.deletedAt), visibleEmployee(scope)))
			.orderBy(asc(employees.fullName), asc(employees.employeeCode));
	}

	async findByCodes(codes: string[], scope: THrScope) {
		if (codes.length === 0) return [];
		return this.database
			.select()
			.from(employees)
			.where(
				and(
					inArray(sql`upper(${employees.employeeCode})`, codes.map((code) => code.toUpperCase())),
					isNull(employees.deletedAt),
					visibleEmployee(scope),
				),
			);
	}

	/** The live salary row of an employee (the bank account lives there, Q39). */
	async findBank(employeeId: string) {
		const [row] = await this.database
			.select()
			.from(employeeSalaries)
			.where(and(eq(employeeSalaries.employeeId, employeeId), isNull(employeeSalaries.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	/** Upserts the bank account on the employee's current salary row. */
	async saveBank(employeeId: string, data: TEmployeeSalaryBody) {
		const now = new Date();
		const current = await this.findBank(employeeId);
		if (current) {
			const [row] = await this.database
				.update(employeeSalaries)
				.set({ ...data, updatedAt: now })
				.where(and(eq(employeeSalaries.id, current.id), isNull(employeeSalaries.deletedAt)))
				.returning();
			return row!;
		}
		const [row] = await this.database
			.insert(employeeSalaries)
			.values({
				...data,
				employeeId,
				baseSalary: 0,
				fixedAllowances: 0,
				effectiveFrom: new Date().toISOString().slice(0, 10),
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		return row!;
	}
}
