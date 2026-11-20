import { CACHE_CLIENT_TOKEN, DRIZZLE_TOKEN } from '@di/provider';
import {
	TVillageInsert,
	TVillageSelect,
	district,
	province,
	regency,
	village,
} from '@drizzle/schemas/location.schema';
import { TPaginationResult } from '@ims-erp/common';
import { paginationResult } from '@utils/pagination.util';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, eq, ilike, inArray, isNotNull, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import { cacheIdKey, cacheListKey } from '@utils/cache.util';
import type { ICacheClient } from '@cache/cache.client';
import type {
	IVillageRepository,
	TVillagePaginationRequest,
	TVillagePath,
} from '../contracts/village.repository.interface';

/**
 * Drizzle + Redis implementation of {@link IVillageRepository}.
 *
 * @remarks
 * Mirrors the district repository: cache-aside with a 5-minute TTL on hot
 * reads, explicit invalidation on writes, per-parent-district caching for
 * the `findByDistrict*` lookups.
 */
@injectable()
export class VillageRepository implements IVillageRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: ICacheClient,
	) {}

	/** Redis key namespace for this repository's cache entries. */
	private readonly cachePrefix = 'location:village';

	/**
	 * Fetches one filtered page of villages.
	 *
	 * @remarks
	 * Never cached: filters change the result set per request, so caching
	 * would need a per-filter key with little hit value.
	 *
	 * @param request - Page settings plus optional `code`/`name`/`districtId` filters
	 */
	async paginate(
		request: TVillagePaginationRequest,
	): Promise<TPaginationResult<TVillageSelect>> {
		const { page, limit, code, name, districtId } = request;

		const filters = [
			isNull(village.deletedAt),
			code ? ilike(village.code, `%${code}%`) : undefined,
			name ? ilike(village.name, `%${name}%`) : undefined,
			districtId ? eq(village.districtId, districtId) : undefined,
		].filter(Boolean);
		const where = and(...filters);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(village)
			.where(where);

		const data = await this.database
			.select()
			.from(village)
			.where(where)
			.orderBy(asc(village.name))
			.limit(limit)
			.offset((page - 1) * limit);

		return paginationResult(request, total, data);
	}

	/**
	 * Inserts one village and invalidates its own and its parent's cache.
	 */
	async create(item: TVillageInsert): Promise<TVillageSelect> {
		const [created] = await this.database
			.insert(village)
			.values(item)
			.returning();

		await this.invalidate([created.id], [created.districtId]);
		return created;
	}

	/**
	 * Bulk-inserts villages and invalidates their cache entries.
	 */
	async createMany(items: TVillageInsert[]): Promise<TVillageSelect[]> {
		const created = await this.database
			.insert(village)
			.values(items)
			.returning();

		await this.invalidate(
			created.map((row) => row.id),
			[...new Set(created.map((row) => row.districtId).filter(Boolean))],
		);
		return created;
	}

	/**
	 * Fetches all non-deleted villages, ordered by name.
	 *
	 * @remarks
	 * Cache-aside: the full list is cached under `{prefix}:all` and treated
	 * as immutable reference data, so any write evicts it.
	 */
	async findAll(): Promise<TVillageSelect[]> {
		return this.cache.remember(cacheListKey(this.cachePrefix), () =>
			this.database
				.select()
				.from(village)
				.where(isNull(village.deletedAt))
				.orderBy(asc(village.name)),
		);
	}

	/**
	 * Fetches every village, soft-deleted rows included. Admin/recovery view.
	 */
	async findAllWithDeleted(): Promise<TVillageSelect[]> {
		return this.database.select().from(village).orderBy(asc(village.name));
	}

	/**
	 * Fetches one non-deleted village by id.
	 *
	 * @remarks
	 * Cache-aside with negative caching: an absent row is cached as the
	 * literal string `'null'` so repeated misses do not hit the database.
	 *
	 * @returns The village, or `null` when absent or soft-deleted
	 */
	async findById(id: string | number): Promise<TVillageSelect | null> {
		return this.cache.remember(cacheIdKey(this.cachePrefix, id), async () => {
			const [row] = await this.database
				.select()
				.from(village)
				.where(and(eq(village.id, String(id)), isNull(village.deletedAt)));
			return row ?? null;
		});
	}

	/**
	 * Fetches non-deleted villages by ids. Never cached.
	 */
	async findByIds(ids: (string | number)[]): Promise<TVillageSelect[]> {
		return this.database
			.select()
			.from(village)
			.where(
				and(inArray(village.id, ids.map(String)), isNull(village.deletedAt)),
			);
	}

	/**
	 * Fetches one soft-deleted village by id. Always a direct read.
	 *
	 * @returns The soft-deleted village, or `null` when it does not exist
	 * or is not deleted
	 */
	async findSoftDeletedById(id: string | number): Promise<TVillageSelect | null> {
		const [row] = await this.database
			.select()
			.from(village)
			.where(and(eq(village.id, String(id)), isNotNull(village.deletedAt)));
		return row ?? null;
	}

	/**
	 * Partially updates a non-deleted village and invalidates its cache.
	 */
	async update(
		id: string | number,
		item: Partial<TVillageInsert>,
	): Promise<TVillageSelect | null> {
		const [updated] = await this.database
			.update(village)
			.set(item)
			.where(and(eq(village.id, String(id)), isNull(village.deletedAt)))
			.returning();

		if (updated) await this.invalidate([updated.id], [updated.districtId]);
		return updated ?? null;
	}

	/** Soft-deletes one village (stamps `deletedAt`). */
	async delete(id: string | number): Promise<void> {
		await this.softDeleteMany([String(id)]);
	}

	/** Soft-deletes multiple villages in one update. */
	async deleteMany(ids: (string | number)[]): Promise<void> {
		await this.softDeleteMany(ids.map(String));
	}

	/** Permanently removes one village. Infra/purge only. */
	async forceDelete(id: string | number): Promise<void> {
		await this.forceDeleteMany([id]);
	}

	/**
	 * Permanently removes villages. Infra/purge only — feature code must
	 * use {@link delete} (soft-delete hard rule).
	 */
	async forceDeleteMany(ids: (string | number)[]): Promise<void> {
		const affected = await this.database
			.delete(village)
			.where(inArray(village.id, ids.map(String)))
			.returning({ id: village.id, districtId: village.districtId });
		await this.invalidate(
			affected.map((row) => row.id),
			[...new Set(affected.map((row) => row.districtId).filter(Boolean))],
		);
	}

	/**
	 * Restores a soft-deleted village by clearing `deletedAt`.
	 */
	async restore(id: string | number): Promise<TVillageSelect | null> {
		const [restored] = await this.database
			.update(village)
			.set({ deletedAt: null })
			.where(and(eq(village.id, String(id)), isNotNull(village.deletedAt)))
			.returning();

		if (restored) await this.invalidate([restored.id], [restored.districtId]);
		return restored ?? null;
	}

	/**
	 * Fetches all non-deleted villages of one district by id.
	 *
	 * @remarks
	 * Cache-aside keyed per parent: `{prefix}:district:{districtId}`.
	 */
	async findByDistrictId(districtId: string): Promise<TVillageSelect[]> {
		return this.cache.remember(`${this.cachePrefix}:district:${districtId}`, () =>
			this.database
				.select()
				.from(village)
				.where(and(eq(village.districtId, districtId), isNull(village.deletedAt)))
				.orderBy(asc(village.name)),
		);
	}

	/**
	 * Fetches non-deleted villages for multiple districts by id. Never cached.
	 */
	async findByDistrictIds(districtIds: string[]): Promise<TVillageSelect[]> {
		if (districtIds.length === 0) return [];
		return this.database
			.select()
			.from(village)
			.where(
				and(
					inArray(village.districtId, districtIds),
					isNull(village.deletedAt),
				),
			)
			.orderBy(asc(village.name));
	}

	/**
	 * Fetches non-deleted villages of one district, resolved by its code.
	 */
	async findByDistrictCode(districtCode: string): Promise<TVillageSelect[]> {
		return this.findByDistrictCodes([districtCode]);
	}

	/**
	 * Fetches non-deleted villages for the given district codes.
	 *
	 * @remarks
	 * Resolves codes to district ids first (uncached, one query), then
	 * reuses {@link findByDistrictIds}.
	 */
	async findByDistrictCodes(districtCodes: string[]): Promise<TVillageSelect[]> {
		if (districtCodes.length === 0) return [];

		const parents = await this.database
			.select({ id: district.id })
			.from(district)
			.where(inArray(district.code, districtCodes));
		if (parents.length === 0) return [];

		return this.findByDistrictIds(parents.map((row) => row.id));
	}

	/**
	 * Fetches the full administrative path of the given villages.
	 *
	 * @remarks
	 * One batched left join inside the location schema; a soft-deleted parent
	 * yields a null name rather than dropping the village row.
	 */
	async findVillagePaths(villageIds: string[]): Promise<TVillagePath[]> {
		if (villageIds.length === 0) return [];

		const rows = await this.database
			.select({
				villageId: village.id,
				villageName: village.name,
				districtId: district.id,
				districtName: district.name,
				regencyId: regency.id,
				regencyName: regency.name,
				provinceId: province.id,
				provinceName: province.name,
			})
			.from(village)
			.leftJoin(district, eq(village.districtId, district.id))
			.leftJoin(regency, eq(district.regencyId, regency.id))
			.leftJoin(province, eq(regency.provinceId, province.id))
			.where(
				and(inArray(village.id, villageIds), isNull(village.deletedAt)),
			);

		return rows;
	}

	/**
	 * Marks the given rows deleted and invalidates their cache entries.
	 */
	private async softDeleteMany(ids: string[]): Promise<void> {
		const affected = await this.database
			.update(village)
			.set({ deletedAt: new Date() })
			.where(and(inArray(village.id, ids), isNull(village.deletedAt)))
			.returning({ id: village.id, districtId: village.districtId });
		await this.invalidate(
			affected.map((row) => row.id),
			[...new Set(affected.map((row) => row.districtId).filter(Boolean))],
		);
	}

	/**
	 * Evicts the list cache, per-id entries, and parent-scoped entries.
	 */
	private async invalidate(ids: string[], districtIds: (string | null)[]): Promise<void> {
		await this.cache.del(
			cacheListKey(this.cachePrefix),
			...ids.map((id) => cacheIdKey(this.cachePrefix, id)),
			...(districtIds.length
				? districtIds.map((did) => `${this.cachePrefix}:district:${did}`)
				: []),
		);
	}
}
