import { CACHE_CLIENT_TOKEN, DRIZZLE_TOKEN } from '@di/provider';
import { type SupplierStatus, suppliers, type TSupplierSelect } from '@drizzle/schemas/procurement.schema';
import { likePattern } from '@drizzle/search';
import type { TPaginationResult } from '@ims-erp/common';
import { and, asc, count, eq, ilike, isNull, or } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { cacheIdKey } from '@utils/cache.util';
import type { ICacheClient } from '@cache/cache.client';
import type { ISupplierRepository, TSupplierCreateData } from '../contracts/procurement.repository.interface';
import type { TSupplierListQuery, TUpdateSupplierInput } from '../contracts/supplier.contract';

/**
 * Drizzle + Redis implementation of {@link ISupplierRepository}.
 *
 * @remarks
 * `findById` and `findByCode` use cache-aside with a 5-minute TTL (the
 * former with negative caching); every write evicts both entries for the
 * affected row. `paginate` is never cached — filters change the result set
 * per request. The code entry must be evicted alongside the id entry
 * because a rename can move the code→row mapping.
 */
@injectable()
export class SupplierRepository implements ISupplierRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: ICacheClient,
	) {}

	/** Redis key namespace for this repository's cache entries. */
	private readonly cachePrefix = 'procurement:supplier';

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
		return this.cache.remember(cacheIdKey(this.cachePrefix, id), async () => {
			const [row] = await this.database
				.select()
				.from(suppliers)
				.where(this.live(id))
				.limit(1);
			return row ?? null;
		});
	}

	async findByCode(code: string): Promise<TSupplierSelect | null> {
		return this.cache.remember(`${this.cachePrefix}:code:${code}`, async () => {
			const [row] = await this.database
				.select()
				.from(suppliers)
				.where(and(eq(suppliers.code, code), isNull(suppliers.deletedAt)))
				.limit(1);
			return row ?? null;
		});
	}

	async create(data: TSupplierCreateData): Promise<TSupplierSelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(suppliers)
			.values({ ...data, status: 'active', createdAt: now, updatedAt: now })
			.returning();
		await this.invalidate(row);
		return row;
	}

	async update(id: string, patch: TUpdateSupplierInput): Promise<TSupplierSelect | null> {
		const [row] = await this.database
			.update(suppliers)
			.set({ ...patch, updatedAt: new Date() })
			.where(this.live(id))
			.returning();
		if (row) await this.invalidate(row);
		return row ?? null;
	}

	async transitionStatus(id: string, from: SupplierStatus, to: SupplierStatus): Promise<TSupplierSelect | null> {
		const [row] = await this.database
			.update(suppliers)
			.set({ status: to, updatedAt: new Date() })
			.where(and(this.live(id), eq(suppliers.status, from)))
			.returning();
		if (row) await this.invalidate(row);
		return row ?? null;
	}

	/**
	 * Evicts the id and code cache entries for the given row.
	 */
	private async invalidate(row: TSupplierSelect): Promise<void> {
		await this.cache.del(
			cacheIdKey(this.cachePrefix, row.id),
			`${this.cachePrefix}:code:${row.code}`,
		);
	}
}
