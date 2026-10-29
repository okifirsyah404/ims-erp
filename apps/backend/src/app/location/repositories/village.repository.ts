import { DRIZZLE_TOKEN, REDIS_TOKEN } from '@di/provider';
import {
	TVillageInsert,
	TVillageSelect,
	district,
	village,
} from '@drizzle/schemas/location.schema';
import { TPaginationResult } from '@ims-erp/common';
import { RedisClient } from 'bun';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, eq, ilike, inArray, isNotNull, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	IVillageRepository,
	TVillagePaginationRequest,
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
		@inject(REDIS_TOKEN) private readonly redisClient: RedisClient,
	) {}

	private readonly cachePrefix = 'location:village';
	private readonly cacheTtlSeconds = 300;

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

		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data,
		};
	}

	async create(item: TVillageInsert): Promise<TVillageSelect> {
		const [created] = await this.database
			.insert(village)
			.values(item)
			.returning();

		await this.invalidate([created.id], [created.districtId]);
		return created;
	}

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

	async findAll(): Promise<TVillageSelect[]> {
		const cacheKey = `${this.cachePrefix}:all`;
		const cached = await this.redisClient.get(cacheKey);
		if (cached) return JSON.parse(cached) as TVillageSelect[];

		const rows = await this.database
			.select()
			.from(village)
			.where(isNull(village.deletedAt))
			.orderBy(asc(village.name));

		await this.redisClient.set(cacheKey, JSON.stringify(rows), 'EX', this.cacheTtlSeconds);
		return rows;
	}

	async findAllWithDeleted(): Promise<TVillageSelect[]> {
		return this.database.select().from(village).orderBy(asc(village.name));
	}

	async findById(id: string | number): Promise<TVillageSelect | null> {
		const cacheKey = `${this.cachePrefix}:id:${id}`;
		const cached = await this.redisClient.get(cacheKey);
		if (cached === 'null') return null;
		if (cached) return JSON.parse(cached) as TVillageSelect;

		const [row] = await this.database
			.select()
			.from(village)
			.where(and(eq(village.id, String(id)), isNull(village.deletedAt)));

		await this.redisClient.set(cacheKey, JSON.stringify(row ?? null), 'EX', this.cacheTtlSeconds);
		return row ?? null;
	}

	async findByIds(ids: (string | number)[]): Promise<TVillageSelect[]> {
		return this.database
			.select()
			.from(village)
			.where(
				and(inArray(village.id, ids.map(String)), isNull(village.deletedAt)),
			);
	}

	async findSoftDeletedById(id: string | number): Promise<TVillageSelect | null> {
		const [row] = await this.database
			.select()
			.from(village)
			.where(and(eq(village.id, String(id)), isNotNull(village.deletedAt)));
		return row ?? null;
	}

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

	async delete(id: string | number): Promise<void> {
		await this.softDeleteMany([String(id)]);
	}

	async deleteMany(ids: (string | number)[]): Promise<void> {
		await this.softDeleteMany(ids.map(String));
	}

	async forceDelete(id: string | number): Promise<void> {
		await this.forceDeleteMany([id]);
	}

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

	async restore(id: string | number): Promise<TVillageSelect | null> {
		const [restored] = await this.database
			.update(village)
			.set({ deletedAt: null })
			.where(and(eq(village.id, String(id)), isNotNull(village.deletedAt)))
			.returning();

		if (restored) await this.invalidate([restored.id], [restored.districtId]);
		return restored ?? null;
	}

	async findByDistrictId(districtId: string): Promise<TVillageSelect[]> {
		const cacheKey = `${this.cachePrefix}:district:${districtId}`;
		const cached = await this.redisClient.get(cacheKey);
		if (cached) return JSON.parse(cached) as TVillageSelect[];

		const rows = await this.database
			.select()
			.from(village)
			.where(and(eq(village.districtId, districtId), isNull(village.deletedAt)))
			.orderBy(asc(village.name));

		await this.redisClient.set(cacheKey, JSON.stringify(rows), 'EX', this.cacheTtlSeconds);
		return rows;
	}

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

	async findByDistrictCode(districtCode: string): Promise<TVillageSelect[]> {
		return this.findByDistrictCodes([districtCode]);
	}

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
		await this.redisClient.del(
			`${this.cachePrefix}:all`,
			...ids.map((id) => `${this.cachePrefix}:id:${id}`),
			...(districtIds.length
				? districtIds.map((did) => `${this.cachePrefix}:district:${did}`)
				: []),
		);
	}
}
