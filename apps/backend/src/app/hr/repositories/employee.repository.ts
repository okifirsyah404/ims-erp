import { DRIZZLE_TOKEN } from '@di/provider';
import { likePattern } from '@drizzle/search';
import { bankAccounts, employees } from '@drizzle/schemas/hr.schema';
import { and, asc, count, eq, ilike, inArray, isNull, or } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { TBankAccountBody, TEmployeeListQuery } from '../contracts/hr.contract';
import type { IEmployeeRepository } from '../contracts/hr.repository.interface';

/** Drizzle implementation of {@link IEmployeeRepository}. */
@injectable()
export class EmployeeRepository implements IEmployeeRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async paginate({ page, limit, search, status }: TEmployeeListQuery) {
		const where = and(
			isNull(employees.deletedAt),
			status ? eq(employees.employmentStatus, status) : undefined,
			search
				? or(
						ilike(employees.fullName, likePattern(search)),
						ilike(employees.employeeCode, likePattern(search)),
						ilike(employees.position, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database.select({ value: count() }).from(employees).where(where);
		const data = await this.database
			.select()
			.from(employees)
			.where(where)
			.orderBy(asc(employees.fullName), asc(employees.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
	}

	async findById(id: string) {
		const [row] = await this.database
			.select()
			.from(employees)
			.where(and(eq(employees.id, id), isNull(employees.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	findByCodes(codes: string[]) {
		if (codes.length === 0) return Promise.resolve([]);
		return this.database
			.select()
			.from(employees)
			.where(and(inArray(employees.employeeCode, codes), isNull(employees.deletedAt)));
	}

	listActive() {
		return this.database
			.select()
			.from(employees)
			.where(and(isNull(employees.deletedAt), eq(employees.employmentStatus, 'active')))
			.orderBy(asc(employees.fullName));
	}

	async create(data: Parameters<IEmployeeRepository['create']>[0]) {
		const now = new Date();
		const [row] = await this.database
			.insert(employees)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async update(id: string, data: Parameters<IEmployeeRepository['update']>[1]) {
		const [row] = await this.database
			.update(employees)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(employees.id, id), isNull(employees.deletedAt)))
			.returning();
		return row ?? null;
	}

	async findBank(employeeId: string) {
		const [row] = await this.database
			.select()
			.from(bankAccounts)
			.where(and(eq(bankAccounts.employeeId, employeeId), isNull(bankAccounts.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async saveBank(employeeId: string, data: TBankAccountBody) {
		const now = new Date();
		const [row] = await this.database
			.insert(bankAccounts)
			.values({ ...data, employeeId, createdAt: now, updatedAt: now })
			.onConflictDoUpdate({
				target: bankAccounts.employeeId,
				targetWhere: isNull(bankAccounts.deletedAt),
				set: { ...data, updatedAt: now },
			})
			.returning();
		return row;
	}
}
