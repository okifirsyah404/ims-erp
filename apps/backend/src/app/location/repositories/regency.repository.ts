import { CACHE_CLIENT_TOKEN, DRIZZLE_TOKEN } from '@di/provider';
import {
	TRegencyInsert,
	TRegencySelect,
	province,
	regency,
} from '@drizzle/schemas/location.schema';
import { TPaginationResult } from '@ims-erp/common';
import { paginationResult } from '@utils/pagination.util';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, eq, ilike, inArray, isNotNull, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import { cacheIdKey, cacheListKey } from '@utils/cache.util';
import type { ICacheClient } from '@cache/cache.client';
import type {
	IRegencyRepository,
	TRegencyPaginationRequest,
} from '../contracts/regency.repository.interface';

/**
 * Drizzle + Redis implementation of {@link IRegencyRepository}.
 *
 * @remarks
 * Same cache-aside strategy as the province repository: hot reads get a
 * 5-minute TTL, writes invalidate explicitly, `paginate` and soft-delete
 * views are never cached. The `findByProvince*` lookups cache per parent
 * province id; code variants resolve the province first (uncached, one
 * query) then reuse the id-based path.
 */
@injectable()
export class RegencyRepository implements IRegencyRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: ICacheClient,
	) {}

	/** Redis key namespace for this repository's cache entries. */
	private readonly cachePrefix = 'location:regency';

	/**
	 * Fetches one filtered page of regencies.
	 *
	 * @remarks
	 * Never cached: filters change the result set per request, so caching
	 * would need a per-filter key with little hit value.
	 *
	 * @param request - Page settings plus optional `code`/`name`/`provinceId` filters
	 */
	async paginate(
		request: TRegencyPaginationRequest,
	): Promise<TPaginationResult<TRegencySelect>> {
		const { page, limit, code, name, provinceId } = request;

		const filters = [
			isNull(regency.deletedAt),
			code ? ilike(regency.code, `%${code}%`) : undefined,
			name ? ilike(regency.name, `%${name}%`) : undefined,
			provinceId ? eq(regency.provinceId, provinceId) : undefined,
		].filter(Boolean);
		const where = and(...filters);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(regency)
			.where(where);

		const data = await this.database
			.select()
			.from(regency)
			.where(where)
			.orderBy(asc(regency.name))
			.limit(limit)
			.offset((page - 1) * limit);

		return paginationResult(request, total, data);
	}

	/**
	 * Inserts one regency and invalidates its own and its parent's cache.
	 */
	async create(item: TRegencyInsert): Promise<TRegencySelect> {
		const [created] = await this.database
			.insert(regency)
			.values(item)
			.returning();

		await this.invalidate(created.id ? [created.id] : [], [created.provinceId]);
		return created;
	}

	/**
	 * Bulk-inserts regencies and invalidates their cache entries.
	 */
	async createMany(items: TRegencyInsert[]): Promise<TRegencySelect[]> {
		const created = await this.database
			.insert(regency)
			.values(items)
			.returning();

		await this.invalidate(
			created.map((row) => row.id),
			[...new Set(created.map((row) => row.provinceId).filter(Boolean))],
		);
		return created;
	}

	/**
	 * Fetches all non-deleted regencies, ordered by name.
	 *
	 * @remarks
	 * Cache-aside: the full list is cached under `{prefix}:all` and treated
	 * as immutable reference data, so any write evicts it.
	 */
	async findAll(): Promise<TRegencySelect[]> {
		return this.cache.remember(cacheListKey(this.cachePrefix), () =>
			this.database
				.select()
				.from(regency)
				.where(isNull(regency.deletedAt))
				.orderBy(asc(regency.name)),
		);
	}

	/**
	 * Fetches every regency, soft-deleted rows included. Admin/recovery view.
	 */
	async findAllWithDeleted(): Promise<TRegencySelect[]> {
		return this.database.select().from(regency).orderBy(asc(regency.name));
	}

	/**
	 * Fetches one non-deleted regency by id.
	 *
	 * @remarks
	 * Cache-aside with negative caching: an absent row is cached as the
	 * literal string `'null'` so repeated misses do not hit the database.
	 *
	 * @returns The regency, or `null` when absent or soft-deleted
	 */
	async findById(id: string | number): Promise<TRegencySelect | null> {
		return this.cache.remember(cacheIdKey(this.cachePrefix, id), async () => {
			const [row] = await this.database
				.select()
				.from(regency)
				.where(and(eq(regency.id, String(id)), isNull(regency.deletedAt)));
			return row ?? null;
		});
	}

	/**
	 * Fetches non-deleted regencies by ids. Never cached.
	 */
	async findByIds(ids: (string | number)[]): Promise<TRegencySelect[]> {
		return this.database
			.select()
			.from(regency)
			.where(
				and(inArray(regency.id, ids.map(String)), isNull(regency.deletedAt)),
			);
	}

	/**
	 * Fetches one soft-deleted regency by id. Always a direct read.
	 *
	 * @returns The soft-deleted regency, or `null` when it does not exist
	 * or is not deleted
	 */
	async findSoftDeletedById(id: string | number): Promise<TRegencySelect | null> {
		const [row] = await this.database
			.select()
			.from(regency)
			.where(and(eq(regency.id, String(id)), isNotNull(regency.deletedAt)));
		return row ?? null;
	}

	/**
	 * Partially updates a non-deleted regency and invalidates its cache.
	 */
	async update(
		id: string | number,
		item: Partial<TRegencyInsert>,
	): Promise<TRegencySelect | null> {
		const [updated] = await this.database
			.update(regency)
			.set(item)
			.where(and(eq(regency.id, String(id)), isNull(regency.deletedAt)))
			.returning();

		if (updated) await this.invalidate([updated.id], [updated.provinceId]);
		return updated ?? null;
	}

	/** Soft-deletes one regency (stamps `deletedAt`). */
	async delete(id: string | number): Promise<void> {
		await this.softDeleteMany([String(id)]);
	}

	/** Soft-deletes multiple regencies in one update. */
	async deleteMany(ids: (string | number)[]): Promise<void> {
		await this.softDeleteMany(ids.map(String));
	}

	/** Permanently removes one regency. Infra/purge only. */
	async forceDelete(id: string | number): Promise<void> {
		await this.forceDeleteMany([id]);
	}

	/**
	 * Permanently removes regencies. Infra/purge only — feature code must
	 * use {@link delete} (soft-delete hard rule).
	 */
	async forceDeleteMany(ids: (string | number)[]): Promise<void> {
		const affected = await this.database
			.delete(regency)
			.where(inArray(regency.id, ids.map(String)))
			.returning({ id: regency.id, provinceId: regency.provinceId });
		await this.invalidate(
			affected.map((row) => row.id),
			[...new Set(affected.map((row) => row.provinceId).filter(Boolean))],
		);
	}

	/**
	 * Restores a soft-deleted regency by clearing `deletedAt`.
	 */
	async restore(id: string | number): Promise<TRegencySelect | null> {
		const [restored] = await this.database
			.update(regency)
			.set({ deletedAt: null })
			.where(and(eq(regency.id, String(id)), isNotNull(regency.deletedAt)))
			.returning();

		if (restored) await this.invalidate([restored.id], [restored.provinceId]);
		return restored ?? null;
	}

	/**
	 * Fetches all non-deleted regencies of one province by id.
	 *
	 * @remarks
	 * Cache-aside keyed per parent: `{prefix}:province:{provinceId}`.
	 */
	async findByProvinceId(provinceId: string): Promise<TRegencySelect[]> {
		return this.cache.remember(`${this.cachePrefix}:province:${provinceId}`, () =>
			this.database
				.select()
				.from(regency)
				.where(
					and(eq(regency.provinceId, provinceId), isNull(regency.deletedAt)),
				)
				.orderBy(asc(regency.name)),
		);
	}

	/**
	 * Fetches non-deleted regencies for multiple provinces by id. Never cached.
	 */
	async findByProvinceIds(provinceIds: string[]): Promise<TRegencySelect[]> {
		if (provinceIds.length === 0) return [];
		return this.database
			.select()
			.from(regency)
			.where(
				and(
					inArray(regency.provinceId, provinceIds),
					isNull(regency.deletedAt),
				),
			)
			.orderBy(asc(regency.name));
	}

	/**
	 * Fetches non-deleted regencies of one province, resolved by its code.
	 */
	async findByProvinceCode(provinceCode: string): Promise<TRegencySelect[]> {
		return this.findByProvinceCodes([provinceCode]);
	}

	/**
	 * Fetches non-deleted regencies for the given province codes.
	 *
	 * @remarks
	 * Resolves codes to province ids first (uncached, one query), then
	 * reuses {@link findByProvinceIds}.
	 */
	async findByProvinceCodes(provinceCodes: string[]): Promise<TRegencySelect[]> {
		if (provinceCodes.length === 0) return [];

		const parents = await this.database
			.select({ id: province.id })
			.from(province)
			.where(inArray(province.code, provinceCodes));
		if (parents.length === 0) return [];

		return this.findByProvinceIds(parents.map((row) => row.id));
	}

	/**
	 * Marks the given rows deleted and invalidates their cache entries.
	 */
	private async softDeleteMany(ids: string[]): Promise<void> {
		const affected = await this.database
			.update(regency)
			.set({ deletedAt: new Date() })
			.where(and(inArray(regency.id, ids), isNull(regency.deletedAt)))
			.returning({ id: regency.id, provinceId: regency.provinceId });
		await this.invalidate(
			affected.map((row) => row.id),
			[...new Set(affected.map((row) => row.provinceId).filter(Boolean))],
		);
	}

	/**
	 * Evicts the list cache, per-id entries, and parent-scoped entries.
	 */
	private async invalidate(ids: string[], provinceIds: (string | null)[]): Promise<void> {
		await this.cache.del(
			cacheListKey(this.cachePrefix),
			...ids.map((id) => cacheIdKey(this.cachePrefix, id)),
			...(provinceIds.length
				? provinceIds.map((pid) => `${this.cachePrefix}:province:${pid}`)
				: []),
		);
	}
}
