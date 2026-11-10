import { DRIZZLE_TOKEN } from '@di/provider';
import {
	employees,
	type TEmployeeInsert,
	type TEmployeeSelect,
} from '@drizzle/schemas/hr.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { and, asc, count, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	IEmployeeRepository,
} from '../contracts/employee.repository.interface';
import type {
	TEmployeeListQuery,
	TEmployeePickerRow,
} from '../contracts/hr.contract';

/**
 * Drizzle implementation of {@link IEmployeeRepository}.
 *
 * @remarks
 * Every read filters soft-deleted rows. Company-level employees are rows
 * with `organization_id IS NULL`; the service decides which callers may see
 * or change them.
 */
@injectable()
export class EmployeeRepository implements IEmployeeRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async list(
		filter: TEmployeeListQuery & {
			organizationIds: string[] | null;
			includeCompany: boolean;
		},
	): Promise<TPaginationResult<TEmployeeSelect>> {
		const { page, limit, search, status, organizationId, scope } = filter;
		const conditions = [isNull(employees.deletedAt)];

		if (scope === 'company') {
			conditions.push(isNull(employees.organizationId));
		} else if (filter.organizationIds !== null) {
			const scopes = filter.organizationIds.length
				? [inArray(employees.organizationId, filter.organizationIds)]
				: [];
			if (filter.includeCompany) scopes.push(isNull(employees.organizationId));
			// At least one branch must exist, else nothing matches.
			conditions.push(scopes.length ? or(...scopes)! : sql`false`);
		}

		if (scope === 'organization') {
			conditions.push(eq(employees.organizationId, filter.organizationId ?? ''));
		} else if (organizationId && scope !== 'company') {
			conditions.push(eq(employees.organizationId, organizationId));
		}

		if (status) conditions.push(eq(employees.employmentStatus, status));
		if (search) {
			conditions.push(
				or(
					ilike(employees.fullName, `%${search}%`),
					ilike(employees.employeeCode, `%${search}%`),
					ilike(employees.email, `%${search}%`),
				)!,
			);
		}

		const where = and(...conditions);
		const [rows, [totals]] = await Promise.all([
			this.database
				.select()
				.from(employees)
				.where(where)
				.orderBy(asc(employees.fullName), asc(employees.id))
				.limit(limit)
				.offset((page - 1) * limit),
			this.database
				.select({ value: count() })
				.from(employees)
				.where(where),
		]);

		const total = Number(totals?.value ?? 0);
		return {
			meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
			data: rows,
		};
	}

	async findById(id: string, tx?: TTx): Promise<TEmployeeSelect | null> {
		const [row] = await (tx ?? this.database)
			.select()
			.from(employees)
			.where(and(eq(employees.id, id), isNull(employees.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findByUserId(userId: string, tx?: TTx): Promise<TEmployeeSelect | null> {
		const [row] = await (tx ?? this.database)
			.select()
			.from(employees)
			.where(and(eq(employees.userId, userId), isNull(employees.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findByEmail(email: string, tx?: TTx): Promise<TEmployeeSelect | null> {
		const [row] = await (tx ?? this.database)
			.select()
			.from(employees)
			.where(and(eq(employees.email, email), isNull(employees.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async codeTaken(
		organizationId: string | null,
		employeeCode: string,
		excludeId?: string,
	): Promise<boolean> {
		const conditions = [
			isNull(employees.deletedAt),
			eq(employees.employeeCode, employeeCode),
			organizationId === null
				? isNull(employees.organizationId)
				: eq(employees.organizationId, organizationId),
		];
		if (excludeId) conditions.push(ne(employees.id, excludeId));
		const [row] = await this.database
			.select({ value: count() })
			.from(employees)
			.where(and(...conditions));
		return Number(row?.value ?? 0) > 0;
	}

	async managerExists(id: string, organizationId: string | null): Promise<boolean> {
		const conditions = [
			eq(employees.id, id),
			isNull(employees.deletedAt),
			organizationId === null
				? isNull(employees.organizationId)
				: or(
						isNull(employees.organizationId),
						eq(employees.organizationId, organizationId),
					)!,
		];
		const [row] = await this.database
			.select({ value: count() })
			.from(employees)
			.where(and(...conditions));
		return Number(row?.value ?? 0) > 0;
	}

	async insert(data: TEmployeeInsert, tx?: TTx): Promise<TEmployeeSelect> {
		const [row] = await (tx ?? this.database).insert(employees).values(data).returning();
		return row;
	}

	async update(
		id: string,
		data: Partial<TEmployeeInsert>,
		tx?: TTx,
	): Promise<TEmployeeSelect | null> {
		const [row] = await (tx ?? this.database)
			.update(employees)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(employees.id, id), isNull(employees.deletedAt)))
			.returning();
		return row ?? null;
	}

	async softDelete(id: string, tx?: TTx): Promise<void> {
		await (tx ?? this.database)
			.update(employees)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(and(eq(employees.id, id), isNull(employees.deletedAt)));
	}

	async picker(
		organizationIds: string[],
		search: string | undefined,
		limit: number,
	): Promise<TEmployeePickerRow[]> {
		const conditions = [
			isNull(employees.deletedAt),
			or(
				inArray(employees.organizationId, organizationIds),
				isNull(employees.organizationId),
			)!,
		];
		if (search) conditions.push(ilike(employees.fullName, `%${search}%`));
		return this.database
			.select({
				id: employees.id,
				employeeCode: employees.employeeCode,
				fullName: employees.fullName,
				organizationId: employees.organizationId,
			})
			.from(employees)
			.where(and(...conditions))
			.orderBy(asc(employees.fullName))
			.limit(limit);
	}
}
