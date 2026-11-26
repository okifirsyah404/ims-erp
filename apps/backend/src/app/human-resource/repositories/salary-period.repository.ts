import { DRIZZLE_TOKEN } from '@di/provider';
import { employeeSalaries } from '@drizzle/schemas/human-resource.schema';
import type { TTx } from '@drizzle/types';
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { ISalaryPeriodRepository } from '../contracts/salary-period.contract';

/** Drizzle implementation of {@link ISalaryPeriodRepository}. Small per-employee sets: no cache. */
@injectable()
export class SalaryPeriodRepository implements ISalaryPeriodRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	listForEmployee(employeeId: string) {
		return this.database
			.select()
			.from(employeeSalaries)
			.where(and(eq(employeeSalaries.employeeId, employeeId), isNull(employeeSalaries.deletedAt)))
			.orderBy(desc(employeeSalaries.effectiveFrom));
	}

	async findById(id: string) {
		const [row] = await this.database
			.select()
			.from(employeeSalaries)
			.where(and(eq(employeeSalaries.id, id), isNull(employeeSalaries.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findLatest(employeeId: string, tx?: TTx) {
		const [row] = await (tx ?? this.database)
			.select()
			.from(employeeSalaries)
			.where(and(eq(employeeSalaries.employeeId, employeeId), isNull(employeeSalaries.deletedAt)))
			.orderBy(desc(employeeSalaries.effectiveFrom))
			.limit(1);
		return row ?? null;
	}

	listOverlapping(start: string, end: string) {
		return this.database
			.select()
			.from(employeeSalaries)
			.where(
				and(
					isNull(employeeSalaries.deletedAt),
					lte(employeeSalaries.effectiveFrom, end),
					or(isNull(employeeSalaries.effectiveTo), gte(employeeSalaries.effectiveTo, start)),
				),
			)
			.orderBy(desc(employeeSalaries.effectiveFrom));
	}

	async insert(row: Parameters<ISalaryPeriodRepository['insert']>[0], tx?: TTx) {
		const now = new Date();
		const [created] = await (tx ?? this.database)
			.insert(employeeSalaries)
			.values({ ...row, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async update(id: string, data: Parameters<ISalaryPeriodRepository['update']>[1], tx?: TTx) {
		const [row] = await (tx ?? this.database)
			.update(employeeSalaries)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(employeeSalaries.id, id), isNull(employeeSalaries.deletedAt)))
			.returning();
		return row ?? null;
	}

	async softDelete(id: string, tx?: TTx) {
		const now = new Date();
		const removed = await (tx ?? this.database)
			.update(employeeSalaries)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(employeeSalaries.id, id), isNull(employeeSalaries.deletedAt)))
			.returning({ id: employeeSalaries.id });
		return removed.length > 0;
	}
}
