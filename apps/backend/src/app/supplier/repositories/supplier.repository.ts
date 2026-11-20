import { DRIZZLE_TOKEN } from '@di/provider';
import {
	suppliers,
	type TSupplierSelect,
} from '@drizzle/schemas/supplier.schema';
import { and, asc, count, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	TSupplierCreateInput,
	TSupplierListQuery,
	TSupplierUpdateInput,
} from '../contracts/supplier.contract';
import type { ISupplierRepository } from '../contracts/supplier.repository.interface';

/**
 * Drizzle implementation of {@link ISupplierRepository}.
 *
 * @remarks
 * Reads are never cached: people are always listed through their company and
 * the set is small. "Primary" is kept single by clearing the previous primary
 * before inserting a new one.
 */
@injectable()
export class SupplierRepository implements ISupplierRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	private live(id: string) {
		return and(eq(suppliers.id, id), isNull(suppliers.deletedAt));
	}

	private filters(query: TSupplierListQuery) {
		return and(
			isNull(suppliers.deletedAt),
			query.companyId ? eq(suppliers.companyId, query.companyId) : undefined,
		);
	}

	async paginate(query: TSupplierListQuery): Promise<TSupplierSelect[]> {
		return this.database
			.select()
			.from(suppliers)
			.where(this.filters(query))
			.orderBy(asc(suppliers.name), asc(suppliers.id))
			.limit(query.limit)
			.offset((query.page - 1) * query.limit);
	}

	async count(query: TSupplierListQuery): Promise<number> {
		const [{ value }] = await this.database
			.select({ value: count() })
			.from(suppliers)
			.where(this.filters(query));
		return Number(value);
	}

	async findById(id: string): Promise<TSupplierSelect | null> {
		const [row] = await this.database
			.select()
			.from(suppliers)
			.where(this.live(id))
			.limit(1);
		return row ?? null;
	}

	async create(
		data: TSupplierCreateInput & { createdBy: string },
	): Promise<TSupplierSelect> {
		const now = new Date();
		if (data.isPrimary && data.companyId) {
			await this.clearPrimary(data.companyId);
		}
		const [row] = await this.database
			.insert(suppliers)
			.values({ ...data, status: 'active', createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async update(
		id: string,
		patch: TSupplierUpdateInput,
	): Promise<TSupplierSelect | null> {
		if (patch.isPrimary) {
			const [current] = await this.database
				.select({ companyId: suppliers.companyId })
				.from(suppliers)
				.where(this.live(id))
				.limit(1);
			if (current?.companyId) await this.clearPrimary(current.companyId);
		}
		const [row] = await this.database
			.update(suppliers)
			.set({ ...patch, updatedAt: new Date() })
			.where(this.live(id))
			.returning();
		return row ?? null;
	}

	async softDelete(id: string): Promise<boolean> {
		const rows = await this.database
			.update(suppliers)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(this.live(id))
			.returning({ id: suppliers.id });
		return rows.length > 0;
	}

	private async clearPrimary(companyId: string): Promise<void> {
		await this.database
			.update(suppliers)
			.set({ isPrimary: false, updatedAt: new Date() })
			.where(
				and(
					eq(suppliers.companyId, companyId),
					eq(suppliers.isPrimary, true),
					isNull(suppliers.deletedAt),
				),
			);
	}
}
