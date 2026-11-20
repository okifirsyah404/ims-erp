import { CACHE_CLIENT_TOKEN, DRIZZLE_TOKEN } from '@di/provider';
import {
	TDistrictInsert,
	TDistrictSelect,
	district,
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
	IDistrictRepository,
	TDistrictPaginationRequest,
} from '../contracts/district.repository.interface';

/**
 * Drizzle + Redis implementation of {@link IDistrictRepository}.
 *
 * @remarks
 * Mirrors the regency repository: cache-aside with a 5-minute TTL on hot
 * reads, explicit invalidation on writes, per-parent-regency caching for
 * the `findByRegency*` lookups.
 */
@injectable()
export class DistrictRepository implements IDistrictRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: ICacheClient,
	) {}

	/** Redis key namespace for this repository's cache entries. */
	private readonly cachePrefix = 'location:district';

	/**
	 * Fetches one filtered page of districts.
	 *
	 * @remarks
	 * Never cached: filters change the result set per request, so caching
	 * would need a per-filter key with little hit value.
	 *
	 * @param request - Page settings plus optional `code`/`name`/`regencyId` filters
	 */
	async paginate(
		request: TDistrictPaginationRequest,
	): Promise<TPaginationResult<TDistrictSelect>> {
		const { page, limit, code, name, regencyId } = request;

		const filters = [
			isNull(district.deletedAt),
			code ? ilike(district.code, `%${code}%`) : undefined,
			name ? ilike(district.name, `%${name}%`) : undefined,
			regencyId ? eq(district.regencyId, regencyId) : undefined,
		].filter(Boolean);
		const where = and(...filters);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(district)
			.where(where);

		const data = await this.database
			.select()
			.from(district)
			.where(where)
			.orderBy(asc(district.name))
			.limit(limit)
			.offset((page - 1) * limit);

		return paginationResult(request, total, data);
	}

	/**
	 * Inserts one district and invalidates its own and its parent's cache.
	 */
	async create(item: TDistrictInsert): Promise<TDistrictSelect> {
		const [created] = await this.database
			.insert(district)
			.values(item)
			.returning();

		await this.invalidate([created.id], [created.regencyId]);
		return created;
	}

	/**
	 * Bulk-inserts districts and invalidates their cache entries.
	 */
	async createMany(items: TDistrictInsert[]): Promise<TDistrictSelect[]> {
		const created = await this.database
			.insert(district)
			.values(items)
			.returning();

		await this.invalidate(
			created.map((row) => row.id),
			[...new Set(created.map((row) => row.regencyId).filter(Boolean))],
		);
		return created;
	}

	/**
	 * Fetches all non-deleted districts, ordered by name.
	 *
	 * @remarks
	 * Cache-aside: the full list is cached under `{prefix}:all` and treated
	 * as immutable reference data, so any write evicts it.
	 */
	async findAll(): Promise<TDistrictSelect[]> {
		return this.cache.remember(cacheListKey(this.cachePrefix), () =>
			this.database
				.select()
				.from(district)
				.where(isNull(district.deletedAt))
				.orderBy(asc(district.name)),
		);
	}

	/**
	 * Fetches every district, soft-deleted rows included. Admin/recovery view.
	 */
	async findAllWithDeleted(): Promise<TDistrictSelect[]> {
		return this.database.select().from(district).orderBy(asc(district.name));
	}

	/**
	 * Fetches one non-deleted district by id.
	 *
	 * @remarks
	 * Cache-aside with negative caching: an absent row is cached as the
	 * literal string `'null'` so repeated misses do not hit the database.
	 *
	 * @returns The district, or `null` when absent or soft-deleted
	 */
	async findById(id: string | number): Promise<TDistrictSelect | null> {
		return this.cache.remember(cacheIdKey(this.cachePrefix, id), async () => {
			const [row] = await this.database
				.select()
				.from(district)
				.where(and(eq(district.id, String(id)), isNull(district.deletedAt)));
			return row ?? null;
		});
	}

	/**
	 * Fetches non-deleted districts by ids. Never cached.
	 */
	async findByIds(ids: (string | number)[]): Promise<TDistrictSelect[]> {
		return this.database
			.select()
			.from(district)
			.where(
				and(inArray(district.id, ids.map(String)), isNull(district.deletedAt)),
			);
	}

	/**
	 * Fetches one soft-deleted district by id. Always a direct read.
	 *
	 * @returns The soft-deleted district, or `null` when it does not exist
	 * or is not deleted
	 */
	async findSoftDeletedById(id: string | number): Promise<TDistrictSelect | null> {
		const [row] = await this.database
			.select()
			.from(district)
			.where(and(eq(district.id, String(id)), isNotNull(district.deletedAt)));
		return row ?? null;
	}

	/**
	 * Partially updates a non-deleted district and invalidates its cache.
	 */
	async update(
		id: string | number,
		item: Partial<TDistrictInsert>,
	): Promise<TDistrictSelect | null> {
		const [updated] = await this.database
			.update(district)
			.set(item)
			.where(and(eq(district.id, String(id)), isNull(district.deletedAt)))
			.returning();

		if (updated) await this.invalidate([updated.id], [updated.regencyId]);
		return updated ?? null;
	}

	/** Soft-deletes one district (stamps `deletedAt`). */
	async delete(id: string | number): Promise<void> {
		await this.softDeleteMany([String(id)]);
	}

	/** Soft-deletes multiple districts in one update. */
	async deleteMany(ids: (string | number)[]): Promise<void> {
		await this.softDeleteMany(ids.map(String));
	}

	/** Permanently removes one district. Infra/purge only. */
	async forceDelete(id: string | number): Promise<void> {
		await this.forceDeleteMany([id]);
	}

	/**
	 * Permanently removes districts. Infra/purge only — feature code must
	 * use {@link delete} (soft-delete hard rule).
	 */
	async forceDeleteMany(ids: (string | number)[]): Promise<void> {
		const affected = await this.database
			.delete(district)
			.where(inArray(district.id, ids.map(String)))
			.returning({ id: district.id, regencyId: district.regencyId });
		await this.invalidate(
			affected.map((row) => row.id),
			[...new Set(affected.map((row) => row.regencyId).filter(Boolean))],
		);
	}

	/**
	 * Restores a soft-deleted district by clearing `deletedAt`.
	 */
	async restore(id: string | number): Promise<TDistrictSelect | null> {
		const [restored] = await this.database
			.update(district)
			.set({ deletedAt: null })
			.where(and(eq(district.id, String(id)), isNotNull(district.deletedAt)))
			.returning();

		if (restored) await this.invalidate([restored.id], [restored.regencyId]);
		return restored ?? null;
	}

	/**
	 * Fetches all non-deleted districts of one regency by id.
	 *
	 * @remarks
	 * Cache-aside keyed per parent: `{prefix}:regency:{regencyId}`.
	 */
	async findByRegencyId(regencyId: string): Promise<TDistrictSelect[]> {
		return this.cache.remember(`${this.cachePrefix}:regency:${regencyId}`, () =>
			this.database
				.select()
				.from(district)
				.where(and(eq(district.regencyId, regencyId), isNull(district.deletedAt)))
				.orderBy(asc(district.name)),
		);
	}

	/**
	 * Fetches non-deleted districts for multiple regencies by id. Never cached.
	 */
	async findByRegencyIds(regencyIds: string[]): Promise<TDistrictSelect[]> {
		if (regencyIds.length === 0) return [];
		return this.database
			.select()
			.from(district)
			.where(
				and(
					inArray(district.regencyId, regencyIds),
					isNull(district.deletedAt),
				),
			)
			.orderBy(asc(district.name));
	}

	/**
	 * Fetches non-deleted districts of one regency, resolved by its code.
	 */
	async findByRegencyCode(regencyCode: string): Promise<TDistrictSelect[]> {
		return this.findByRegencyCodes([regencyCode]);
	}

	/**
	 * Fetches non-deleted districts for the given regency codes.
	 *
	 * @remarks
	 * Resolves codes to regency ids first (uncached, one query), then
	 * reuses {@link findByRegencyIds}.
	 */
	async findByRegencyCodes(regencyCodes: string[]): Promise<TDistrictSelect[]> {
		if (regencyCodes.length === 0) return [];

		const parents = await this.database
			.select({ id: regency.id })
			.from(regency)
			.where(inArray(regency.code, regencyCodes));
		if (parents.length === 0) return [];

		return this.findByRegencyIds(parents.map((row) => row.id));
	}

	/**
	 * Marks the given rows deleted and invalidates their cache entries.
	 */
	private async softDeleteMany(ids: string[]): Promise<void> {
		const affected = await this.database
			.update(district)
			.set({ deletedAt: new Date() })
			.where(and(inArray(district.id, ids), isNull(district.deletedAt)))
			.returning({ id: district.id, regencyId: district.regencyId });
		await this.invalidate(
			affected.map((row) => row.id),
			[...new Set(affected.map((row) => row.regencyId).filter(Boolean))],
		);
	}

	/**
	 * Evicts the list cache, per-id entries, and parent-scoped entries.
	 */
	private async invalidate(ids: string[], regencyIds: (string | null)[]): Promise<void> {
		await this.cache.del(
			cacheListKey(this.cachePrefix),
			...ids.map((id) => cacheIdKey(this.cachePrefix, id)),
			...(regencyIds.length
				? regencyIds.map((rid) => `${this.cachePrefix}:regency:${rid}`)
				: []),
		);
	}
}
