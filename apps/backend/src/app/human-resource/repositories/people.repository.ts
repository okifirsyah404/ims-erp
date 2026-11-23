import { DRIZZLE_TOKEN } from '@di/provider';
import { employees } from '@drizzle/schemas/human-resource.schema';
import { and, asc, eq, inArray, isNull, or, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { THrScope } from '../contracts/hr-records.contract';
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
}
