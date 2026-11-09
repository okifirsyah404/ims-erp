import { DRIZZLE_TOKEN } from '@di/provider';
import { type SupplierStatus, suppliers, type TSupplierSelect } from '@drizzle/schemas/procurement.schema';
import { likePattern } from '@drizzle/search';
import type { TPaginationResult } from '@ims-erp/common';
import { and, asc, count, eq, ilike, isNull, or } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { ISupplierRepository, TSupplierCreateData } from '../contracts/procurement.repository.interface';
import type { TSupplierListQuery, TUpdateSupplierInput } from '../contracts/supplier.contract';

/** Drizzle implementation of {@link ISupplierRepository}. */
@injectable()
export class SupplierRepository implements ISupplierRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private live(id: string) {
		return and(eq(suppliers.id, id), isNull(suppliers.deletedAt));
	}

	async paginate(query: TSupplierListQuery): Promise<TPaginationResult<TSupplierSelect>> {
		const { page, limit, search, status } = query;
		const where = and(
			isNull(suppliers.deletedAt),
			status ? eq(suppliers.status, status) : undefined,
			search
				? or(
						ilike(suppliers.name, likePattern(search)),
						ilike(suppliers.code, likePattern(search)),
						ilike(suppliers.picName, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database.select({ value: count() }).from(suppliers).where(where);
		const data = await this.database
			.select()
			.from(suppliers)
			.where(where)
			.orderBy(asc(suppliers.name), asc(suppliers.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
	}

	async findById(id: string): Promise<TSupplierSelect | null> {
		const [row] = await this.database.select().from(suppliers).where(this.live(id)).limit(1);
		return row ?? null;
	}

	async findByCode(code: string): Promise<TSupplierSelect | null> {
		const [row] = await this.database
			.select()
			.from(suppliers)
			.where(and(eq(suppliers.code, code), isNull(suppliers.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async create(data: TSupplierCreateData): Promise<TSupplierSelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(suppliers)
			.values({ ...data, status: 'active', createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async update(id: string, patch: TUpdateSupplierInput): Promise<TSupplierSelect | null> {
		const [row] = await this.database
			.update(suppliers)
			.set({ ...patch, updatedAt: new Date() })
			.where(this.live(id))
			.returning();
		return row ?? null;
	}

	async transitionStatus(id: string, from: SupplierStatus, to: SupplierStatus): Promise<TSupplierSelect | null> {
		const [row] = await this.database
			.update(suppliers)
			.set({ status: to, updatedAt: new Date() })
			.where(and(this.live(id), eq(suppliers.status, from)))
			.returning();
		return row ?? null;
	}
}
