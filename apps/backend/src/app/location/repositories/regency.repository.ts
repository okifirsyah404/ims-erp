import { DRIZZLE_TOKEN, REDIS_TOKEN } from '@di/provider';
import {
	TRegencyInsert,
	TRegencySelect,
	province,
	regency,
} from '@drizzle/schemas/location.schema';
import { TPaginationResult } from '@ims-erp/common';
import { RedisClient } from 'bun';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, eq, ilike, inArray, isNotNull, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
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
		@inject(REDIS_TOKEN) private readonly redisClient: RedisClient,
	) {}

	private readonly cachePrefix = 'location:regency';
	private readonly cacheTtlSeconds = 300;

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

		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data,
		};
	}

	async create(item: TRegencyInsert): Promise<TRegencySelect> {
		const [created] = await this.database
			.insert(regency)
			.values(item)
			.returning();

		await this.invalidate(created.id ? [created.id] : [], [created.provinceId]);
		return created;
	}

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

	async findAll(): Promise<TRegencySelect[]> {
		const cacheKey = `${this.cachePrefix}:all`;
		const cached = await this.redisClient.get(cacheKey);
		if (cached) return JSON.parse(cached) as TRegencySelect[];

		const rows = await this.database
			.select()
			.from(regency)
			.where(isNull(regency.deletedAt))
			.orderBy(asc(regency.name));

		await this.redisClient.set(cacheKey, JSON.stringify(rows), 'EX', this.cacheTtlSeconds);
		return rows;
	}

	async findAllWithDeleted(): Promise<TRegencySelect[]> {
		return this.database.select().from(regency).orderBy(asc(regency.name));
	}

	async findById(id: string | number): Promise<TRegencySelect | null> {
		const cacheKey = `${this.cachePrefix}:id:${id}`;
		const cached = await this.redisClient.get(cacheKey);
		if (cached === 'null') return null;
		if (cached) return JSON.parse(cached) as TRegencySelect;

		const [row] = await this.database
			.select()
			.from(regency)
			.where(and(eq(regency.id, String(id)), isNull(regency.deletedAt)));

		await this.redisClient.set(cacheKey, JSON.stringify(row ?? null), 'EX', this.cacheTtlSeconds);
		return row ?? null;
	}

	async findByIds(ids: (string | number)[]): Promise<TRegencySelect[]> {
		return this.database
			.select()
			.from(regency)
			.where(
				and(inArray(regency.id, ids.map(String)), isNull(regency.deletedAt)),
			);
	}

	async findSoftDeletedById(id: string | number): Promise<TRegencySelect | null> {
		const [row] = await this.database
			.select()
			.from(regency)
			.where(and(eq(regency.id, String(id)), isNotNull(regency.deletedAt)));
		return row ?? null;
	}

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
			.delete(regency)
			.where(inArray(regency.id, ids.map(String)))
			.returning({ id: regency.id, provinceId: regency.provinceId });
		await this.invalidate(
			affected.map((row) => row.id),
			[...new Set(affected.map((row) => row.provinceId).filter(Boolean))],
		);
	}

	async restore(id: string | number): Promise<TRegencySelect | null> {
		const [restored] = await this.database
			.update(regency)
			.set({ deletedAt: null })
			.where(and(eq(regency.id, String(id)), isNotNull(regency.deletedAt)))
			.returning();

		if (restored) await this.invalidate([restored.id], [restored.provinceId]);
		return restored ?? null;
	}

	async findByProvinceId(provinceId: string): Promise<TRegencySelect[]> {
		const cacheKey = `${this.cachePrefix}:province:${provinceId}`;
		const cached = await this.redisClient.get(cacheKey);
		if (cached) return JSON.parse(cached) as TRegencySelect[];

		const rows = await this.database
			.select()
			.from(regency)
			.where(
				and(eq(regency.provinceId, provinceId), isNull(regency.deletedAt)),
			)
			.orderBy(asc(regency.name));

		await this.redisClient.set(cacheKey, JSON.stringify(rows), 'EX', this.cacheTtlSeconds);
		return rows;
	}

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

	async findByProvinceCode(provinceCode: string): Promise<TRegencySelect[]> {
		return this.findByProvinceCodes([provinceCode]);
	}

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
		await this.redisClient.del(
			`${this.cachePrefix}:all`,
			...ids.map((id) => `${this.cachePrefix}:id:${id}`),
			...(provinceIds.length
				? provinceIds.map((pid) => `${this.cachePrefix}:province:${pid}`)
				: []),
		);
	}
}
