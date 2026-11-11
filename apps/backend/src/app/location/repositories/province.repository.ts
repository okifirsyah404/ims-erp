import { CACHE_CLIENT_TOKEN, DRIZZLE_TOKEN } from '@di/provider';
import {
	TProvinceInsert,
	TProvinceSelect,
	province,
} from '@drizzle/schemas/location.schema';
import { TPaginationResult } from '@ims-erp/common';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, eq, ilike, inArray, isNotNull, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import { cacheIdKey, cacheListKey } from '@utils/cache.util';
import type { ICacheClient } from '@cache/cache.client';
import type {
	IProvinceRepository,
	TProvincePaginationRequest,
} from '../contracts/province.repository.interface';

/**
 * Drizzle + Redis implementation of {@link IProvinceRepository}.
 *
 * @remarks
 * Hot reads (`findAll`, `findById`, `findByIds`) use cache-aside with a
 * 5-minute TTL; every write invalidates the affected keys explicitly.
 * `paginate`, `findAllWithDeleted`, and `findSoftDeletedById` are never
 * cached. All reads except the `*WithDeleted`/`findSoftDeletedById`
 * variants exclude soft-deleted rows.
 */
@injectable()
export class ProvinceRepository implements IProvinceRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: ICacheClient,
	) {}

	/** Redis key namespace for this repository's cache entries. */
	private readonly cachePrefix = 'location:province';

	/**
	 * Fetches one filtered page of provinces.
	 *
	 * @remarks
	 * Never cached: filters change the result set per request, so caching
	 * would need a per-filter key with little hit value.
	 *
	 * @param request - Page settings plus optional `code`/`name` filters
	 */
	async paginate(
		request: TProvincePaginationRequest,
	): Promise<TPaginationResult<TProvinceSelect>> {
		const { page, limit, code, name } = request;

		const filters = [
			isNull(province.deletedAt),
			code ? ilike(province.code, `%${code}%`) : undefined,
			name ? ilike(province.name, `%${name}%`) : undefined,
		].filter(Boolean);
		const where = and(...filters);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(province)
			.where(where);

		const data = await this.database
			.select()
			.from(province)
			.where(where)
			.orderBy(asc(province.name))
			.limit(limit)
			.offset((page - 1) * limit);

		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data,
		};
	}

	async create(item: TProvinceInsert): Promise<TProvinceSelect> {
		const [created] = await this.database
			.insert(province)
			.values(item)
			.returning();

		await this.invalidate([created.id]);
		return created;
	}

	/**
	 * Bulk-inserts provinces and invalidates their cache entries.
	 */
	async createMany(items: TProvinceInsert[]): Promise<TProvinceSelect[]> {
		const created = await this.database
			.insert(province)
			.values(items)
			.returning();

		await this.invalidate(created.map((row) => row.id));
		return created;
	}

	/**
	 * Fetches all non-deleted provinces, ordered by name.
	 *
	 * @remarks
	 * Cache-aside: the full list is cached under `{prefix}:all` and treated
	 * as immutable reference data, so any write evicts it.
	 */
	async findAll(): Promise<TProvinceSelect[]> {
		return this.cache.remember(cacheListKey(this.cachePrefix), () =>
			this.database
				.select()
				.from(province)
				.where(isNull(province.deletedAt))
				.orderBy(asc(province.name)),
		);
	}

	/**
	 * Fetches every province, soft-deleted rows included. Admin/recovery view.
	 */
	async findAllWithDeleted(): Promise<TProvinceSelect[]> {
		return this.database.select().from(province).orderBy(asc(province.name));
	}

	/**
	 * Fetches one non-deleted province by id.
	 *
	 * @remarks
	 * Cache-aside with negative caching: an absent row is cached as the
	 * literal string `'null'` so repeated misses do not hit the database.
	 *
	 * @returns The province, or `null` when absent or soft-deleted
	 */
	async findById(id: string | number): Promise<TProvinceSelect | null> {
		return this.cache.remember(cacheIdKey(this.cachePrefix, id), async () => {
			const [row] = await this.database
				.select()
				.from(province)
				.where(and(eq(province.id, String(id)), isNull(province.deletedAt)));
			return row ?? null;
		});
	}

	/**
	 * Fetches non-deleted provinces by ids. Never cached.
	 */
	async findByIds(ids: (string | number)[]): Promise<TProvinceSelect[]> {
		return this.database
			.select()
			.from(province)
			.where(
				and(inArray(province.id, ids.map(String)), isNull(province.deletedAt)),
			);
	}

	/**
	 * Fetches one soft-deleted province by id. Always a direct read.
	 *
	 * @returns The soft-deleted province, or `null` when it does not exist
	 * or is not deleted
	 */
	async findSoftDeletedById(id: string | number): Promise<TProvinceSelect | null> {
		const [row] = await this.database
			.select()
			.from(province)
			.where(and(eq(province.id, String(id)), isNotNull(province.deletedAt)));
		return row ?? null;
	}

	/**
	 * Partially updates a non-deleted province and invalidates its cache.
	 */
	async update(
		id: string | number,
		item: Partial<TProvinceInsert>,
	): Promise<TProvinceSelect | null> {
		const [updated] = await this.database
			.update(province)
			.set(item)
			.where(and(eq(province.id, String(id)), isNull(province.deletedAt)))
			.returning();

		if (updated) await this.invalidate([updated.id]);
		return updated ?? null;
	}

	/** Soft-deletes one province (stamps `deletedAt`). */
	async delete(id: string | number): Promise<void> {
		await this.softDeleteMany([String(id)]);
	}

	/** Soft-deletes multiple provinces in one update. */
	async deleteMany(ids: (string | number)[]): Promise<void> {
		await this.softDeleteMany(ids.map(String));
	}

	/** Permanently removes one province. Infra/purge only. */
	async forceDelete(id: string | number): Promise<void> {
		await this.forceDeleteMany([id]);
	}

	/**
	 * Permanently removes provinces. Infra/purge only — feature code must
	 * use {@link delete} (soft-delete hard rule).
	 */
	async forceDeleteMany(ids: (string | number)[]): Promise<void> {
		await this.database
			.delete(province)
			.where(inArray(province.id, ids.map(String)));
		await this.invalidate(ids.map(String));
	}

	/**
	 * Restores a soft-deleted province by clearing `deletedAt`.
	 */
	async restore(id: string | number): Promise<TProvinceSelect | null> {
		const [restored] = await this.database
			.update(province)
			.set({ deletedAt: null })
			.where(and(eq(province.id, String(id)), isNotNull(province.deletedAt)))
			.returning();

		if (restored) await this.invalidate([restored.id]);
		return restored ?? null;
	}

	/**
	 * Marks the given rows deleted and invalidates their cache entries.
	 */
	private async softDeleteMany(ids: string[]): Promise<void> {
		await this.database
			.update(province)
			.set({ deletedAt: new Date() })
			.where(and(inArray(province.id, ids), isNull(province.deletedAt)));
		await this.invalidate(ids);
	}

	/**
	 * Evicts the list cache and the per-id entries for the given rows.
	 */
	private async invalidate(ids: string[]): Promise<void> {
		await this.cache.del(
			cacheListKey(this.cachePrefix),
			...ids.map((id) => cacheIdKey(this.cachePrefix, id)),
		);
	}
}
